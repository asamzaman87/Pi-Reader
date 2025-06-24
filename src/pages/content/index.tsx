import { ThemeProvider } from "@/components/theme-provider";
import { createRoot } from 'react-dom/client';
import './style.css';
import Uploader from './uploader';
import { observeElement } from "@/lib/utils";

// ===== SPA URL‐change detector =====
;(function () {
  const notify = () => render(false);
  const wrap = (method: "pushState" | "replaceState") => {
    const orig = history[method];
    history[method] = function (...args) {
      const rv = orig.apply(this, args);
      window.dispatchEvent(new Event("locationchange"));
      return rv;
    };
  };
  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", () => window.dispatchEvent(new Event("locationchange")));
  window.addEventListener("locationchange", notify);
})();

const render = (state: boolean) => {
  if (state) return; //return if shadow root is already present

  const div = document.createElement('div');
  div.id = '__pi-reader-shadow';
  document.body.appendChild(div);

  //resolve over flow issue on firefox/chrome
  const bodyClassName = document.body.className;
  document.body.className = `overflow-hidden ${bodyClassName}`;
  document.body.appendChild(div);

  const rootContainer = document.querySelector('#__pi-reader-shadow');
  if (!rootContainer) throw new Error("Can't find Content root element");

  const root = createRoot(rootContainer);

  root.render(
    <ThemeProvider>
      <Uploader />
    </ThemeProvider>
  );
}
//observes the shadow root of the extension and renders the component if it is not present
observeElement("div#__pi-reader-shadow", render);

// ensure an immediate first‐pass render
render(false);

// polling fallback (tries every 500ms until it sees your container)
const __piReaderPoll = setInterval(() => {
  if (!document.querySelector('#__pi-reader-shadow')) {
    render(false);
  } else {
    clearInterval(__piReaderPoll);
  }
}, 500);