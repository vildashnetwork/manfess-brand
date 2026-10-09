import React from "react";
import ReactDOM from "react-dom/client";
import { SpaHost } from "./SpaHost";
import axios from "axios";
import { getStoredSchoolSection } from "@/lib/schoolSystem";
import { LanguageProvider } from "@/lib/language";
import "./styles.css";

axios.interceptors.request.use((config) => {
  config.headers.set("X-School-Section", getStoredSchoolSection());
  if (config.method?.toLowerCase() === "get") {
    config.params = { ...config.params, section: getStoredSchoolSection() };
  }
  return config;
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <SpaHost />
    </LanguageProvider>
  </React.StrictMode>
);
