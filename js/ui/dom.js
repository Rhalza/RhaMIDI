export const DOM = {
    el: (id) => document.getElementById(id),
    
    create: (tag, className = "", innerHTML = "") => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    },

    query: (selector) => document.querySelector(selector),
    
    on: (element, event, handler) => {
        if (typeof element === 'string') element = document.getElementById(element);
        if (element) element.addEventListener(event, handler);
    }
};