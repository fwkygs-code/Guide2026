import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

alert("FRONTEND UPDATED");

console.log('[BOOT] index.js executing');

const root = ReactDOM.createRoot(document.getElementById("root"));

// BINARY SEARCH TEST: Does React mount at all?
root.render(
  <div style={{ color: 'red', fontSize: '40px', padding: '50px' }}>
    REACT MOUNTS - If you see this, React is working
  </div>
);

// TODO: If you see red text above, restore this code:
// root.render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// );
