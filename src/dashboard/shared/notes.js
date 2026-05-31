const NOTE_ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "br", "div", "p", "ul", "ol", "li", "label", "input"]);
const NOTE_BLOCKED_TAGS = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form"]);

const renderTemplate = (body) => body.replace(/\$\{date\}/g, new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" }));

const sanitizeHtml = (html) => {
  if (!html || typeof document === "undefined") return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html);

  const clean = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const tag = node.tagName.toLowerCase();
    if (NOTE_BLOCKED_TAGS.has(tag)) {
      node.remove();
      return;
    }

    [...node.childNodes].forEach(clean);

    if (!NOTE_ALLOWED_TAGS.has(tag)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    if (tag === "input") {
      const checked = node.checked || node.hasAttribute("checked");
      [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
      node.setAttribute("type", "checkbox");
      if (checked) node.setAttribute("checked", "checked");
      return;
    }

    [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
  };

  [...tpl.content.childNodes].forEach(clean);
  return tpl.innerHTML;
};

const stripHtml = (html) => {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = sanitizeHtml(html);
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
};

export {
  renderTemplate,
  sanitizeHtml,
  stripHtml,
};
