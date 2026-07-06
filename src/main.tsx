import React from "react";
import ReactDOM from "react-dom/client";
import { SpaHost } from "./SpaHost";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SpaHost />
  </React.StrictMode>
);
