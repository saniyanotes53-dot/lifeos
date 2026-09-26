import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {ProductCatalogProvider} from "./catalog/ProductCatalog";
const ProductAdmin = React.lazy(()=>import("./components/ProductAdmin"));
import "./fonts.css";
import "./index.css";
import "./liquid-system.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/^\/admin\/?$/.test(window.location.pathname) ? <React.Suspense fallback={<p>Loading admin…</p>}><ProductAdmin/></React.Suspense> : <ProductCatalogProvider><App /></ProductCatalogProvider>}
  </React.StrictMode>
);
