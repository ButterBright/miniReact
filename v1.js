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

// function render(element, container) {
//     const root =
//         element.tag != "TEXT"
//             ? document.createElement(element.tag)
//             : document.createTextNode("")
//     console.log(Object(element.props))
//     if (element.props) {
//         Object.keys(element.props).forEach(
//             key => (root[key] = element.props[key])
//         )
//     }
//     element.children.forEach(child => render(child, root))
//     container.appendChild(root)
// }

let nextUnitOfWork = null
let wipRoot = null
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

function performUnitOfWork(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    const elements = fiber.children
    let index = 0
    let prevSibling = null

    while (elements && index < elements.length) {
        const element = elements[index]

        const newFiber = {
            tag: element.tag,
            props: element.props,
            children: element.children,
            parent: fiber,
            dom: null,
        }

        if (index == 0) {
            fiber.child = newFiber
        } else {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index++
    }

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
        Object.keys(fiber.props).forEach(key => (dom[key] = fiber.props[key]))
    }

    return dom
}

function commitRoot() {
    commitWork(wipRoot.child)
    wipRoot = null
}

function commitWork(fiber) {
    if (!fiber) return

    const parentDom = fiber.parent.dom
    parentDom.appendChild(fiber.dom)
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function render(element, container) {
    wipRoot = {
        dom: container,
        children: [element],
    }
    nextUnitOfWork = wipRoot
}

/** @jsx Didact.createElement */
const element = (
    <div style="background: salmon">
        <h1>Hello World</h1>
        <h2 style="text-align:right">from Didact</h2>
    </div>
)

const container = document.getElementById("root")
Didact.render(element, container)

// const elem = createElement(
//   "div",
//   {title: "foo"},
//   createElement(
//     "a",
//     null,
//     "bar"
//   ),
//   createElement(
//     "b",
//     null,
//     null
//   )
// )
// console.log(elem)

// const element = (
//   <div id="foo">
//     <a>bar</a>
//     <b />
//   </div>
// )
