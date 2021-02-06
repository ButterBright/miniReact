const Didact = {
    createElement,
    render,
    useState,
}

function createElement(tag, props, ...children) {
    return {
        tag: tag,
        props,
        children: children.map(child =>
            typeof child === "object" ? child : createTextNode(child)
        ),
    }
}

function createTextNode(text) {
    return {
        tag: "TEXT",
        props: {
            nodeValue: text,
        },
        children: [],
    }
}

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = null
let wipFiber = null
let hookIndex = null
requestIdleCallback(workLoop)

function workLoop(deadline) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
        shouldYield = deadline.timeRemaining() < 1
    }

    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }
    requestIdleCallback(workLoop)
}

function commitRoot() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

function commitWork(fiber) {
    if (!fiber) return

    let parentFiber = fiber.parent
    while (!parentFiber.dom) {
        parentFiber = parentFiber.parent
    }
    const parentDom = parentFiber.dom

    if (fiber.effectTag == "UPDATE") {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag == "PLACEMENT" && fiber.dom) {
        parentDom.appendChild(fiber.dom)
    } else if (fiber.effectTag == "DELETION") {
        commitDeletion(fiber.child, parentDom)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitDeletion(fiber, parentDom) {
    if (fiber.dom) {
        parentDom.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, parentDom)
    }
}

function updateDom(dom, alternateProps, props) {
    Object.keys(alternateProps)
        .filter(key => !key.startsWith("on"))
        .filter(old => !(old in props))
        .forEach(key => (dom[key] = ""))

    Object.keys(props)
        .filter(key => !key.startsWith("on"))
        .filter(
            changed =>
                props[changed] != alternateProps[changed] || !(changed in props)
        )
        .forEach(key => (dom[key] = props[key]))

    Object.keys(alternateProps)
        .filter(key => key.startsWith("on"))
        .filter(old => !(old in props))
        .forEach(key => {
            const eventType = key.toLocaleLowerCase().substring(2)
            dom.removeEventListener(eventType, alternateProps[key])
        })

    Object.keys(props)
        .filter(key => key.startsWith("on"))
        .filter(
            changed =>
                props[changed] != alternateProps[changed] || !(changed in props)
        )
        .forEach(key => {
            const eventType = key.toLocaleLowerCase().substring(2)
            dom.addEventListener(eventType, props[key])
        })
}

function performUnitOfWork(fiber) {
    if (fiber.tag instanceof Function) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    if (fiber.child) return fiber.child
    if (fiber.sibling) return fiber.sibling
    while (fiber) {
        fiber = fiber.parent
        if (fiber && fiber.sibling) return fiber.sibling
    }
}

function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    const children = [fiber.tag(fiber.props)]
    reconcileChildren(fiber, children)
}

function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    const elements = fiber.children
    reconcileChildren(fiber, elements)
}

function createDom(fiber) {
    const dom =
        fiber.tag == "TEXT"
            ? document.createTextNode("")
            : document.createElement(fiber.tag)
    if (fiber.props) {
        Object.keys(fiber.props)
            .filter(key => !key.startsWith("on"))
            .forEach(key => (dom[key] = fiber.props[key]))

        Object.keys(fiber.props)
            .filter(key => key.startsWith("on"))
            .forEach(key => {
                const eventType = key.toLocaleLowerCase().substring(2)
                dom.addEventListener(eventType, fiber.props[key])
            })
    }

    return dom
}

function reconcileChildren(wipFiber, elements) {
    let index = 0
    let prevSibling = null
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    while ((elements && index < elements.length) || oldFiber) {
        const element = elements[index]
        let newFiber = null
        const sameTag = oldFiber && element && element.tag == oldFiber.tag
        if (sameTag) {
            newFiber = {
                tag: oldFiber.tag,
                props: element.props,
                children: element.children,
                parent: wipFiber,
                dom: oldFiber.dom,
                alternate: oldFiber,
                effectTag: "UPDATE",
            }
        }
        if (!sameTag && element) {
            newFiber = {
                tag: element.tag,
                props: element.props,
                children: element.children,
                parent: wipFiber,
                dom: null,
                alternate: null,
                effectTag: "PLACEMENT",
            }
        }
        if (!sameTag && oldFiber) {
            oldFiber.effectTag = "DELETION"
            deletions.push(oldFiber)
        }

        if (index == 0) {
            wipFiber.child = newFiber
        } else {
            prevSibling.sibling = newFiber
        }

        if (oldFiber) oldFiber = oldFiber.sibling

        prevSibling = newFiber
        index++
    }
}

function useState(init) {
    const oldHook =
        wipFiber.alternate &&
        wipFiber.alternate.hooks &&
        wipFiber.alternate.hooks[hookIndex]
    const hook = {
        state: oldHook ? oldHook.state : init,
        queue: [],
    }
    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => {
        hook.state = action(hook.state)
    })

    const setState = action => {
        console.log(hook.queue)
        hook.queue.push(action)
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            children: currentRoot.children,
            alternate: currentRoot,
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}

function render(element, container) {
    wipRoot = {
        dom: container,
        children: [element],
        alternate: currentRoot,
    }
    nextUnitOfWork = wipRoot
    deletions = []
}

/** @jsx Didact.createElement */
function Counter() {
    const [state, setState] = Didact.useState(1)
    return <h1 onClick={() => setState(c => c + 1)}>Count: {state}</h1>
}
const element = <Counter />
const container = document.getElementById("root")
Didact.render(element, container)
