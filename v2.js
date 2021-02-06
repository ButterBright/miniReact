
const Didact = {
    createElement,
    render,
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

    const parentDom = fiber.parent.dom
    if (fiber.effectTag == "UPDATE") {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag == "PLACEMENT") {
        parentDom.appendChild(fiber.dom)
    } else if (fiber.effectTag == "DELETION") {
        parentDom.removeChild(fiber.dom)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
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
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    const elements = fiber.children

    reconcileChildren(fiber, elements)

    if (fiber.child) return fiber.child
    if (fiber.sibling) return fiber.sibling
    while (fiber) {
        fiber = fiber.parent
        if (fiber && fiber.sibling) return fiber.sibling
    }
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
const container = document.getElementById("root")

const updateValue = e => {
    rerender(e.target.value)
}

const rerender = value => {
    const element = (
        <div>
            <input onInput={updateValue} value={value} />
            <h2>Hello {value}</h2>
        </div>
    )
    Didact.render(element, container)
}

rerender("World")
