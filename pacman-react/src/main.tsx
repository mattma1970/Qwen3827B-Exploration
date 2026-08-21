import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

console.log("PERU MAN — react+ts build (pacman-react)");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
