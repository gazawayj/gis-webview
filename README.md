# GIS WebView

A web application for interactive geospatial visualization and experimentation. 
**Live at:** [gazawayj.github.io/](https://gazawayj.github.io/)

---

## Application Status

| Frontend | Backend |
|:--:|:--:|
| <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml/badge.svg" /></a> |
| <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml/badge.svg" /></a> |
| <a href="https://github.com/gazawayj/gis-webview/actions/workflows/tests-frontend.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/tests-frontend.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/tests-backend.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/tests-backend.yml/badge.svg" /></a> |

---

## Technology Stack

[![Tech Stack](https://skillicons.dev/icons?i=github,js,html,css,py,nodejs,angular)](https://skillicons.dev)

---

## Overview

**GIS WebView** is an evolving geospatial web platform designed to explore modern patterns for GIS visualization directly in the browser.

The project focuses on rendering planetary-scale spatial data. Raster imagery, vector layers, and tiled map services—using **Angular** and **OpenLayers**. The frontend provides interactive mapping, layer management, and user controls, while the backend serves GIS-friendly formats such as **GeoJSON**, raster metadata (coming soon), and map tiles.

This project serves both as:

- A learning project for creating a modern web-based GIS, usable for planetary and exo-planetary investigations.
- A foundation for a more complete, extensible GIS visualization system utilizing AI-assistance (AI features coming soon).

---

## Key Features

- **Planetary Basemap Support**  
  Early support for Earth, Mars, and Moon datasets.  

- **Automated Quality Control**  
  CI pipelines powered by GitHub Actions handle builds, linting, and tests.  

- **Optimized Frontend Bundling**  
  Webpack-based build using OpenLayers.  

- **Standards-Based Spatial Formats**  
  Support for GeoJSON/CSV files and URLs.

---

## Continuous Integration

Code quality and stability are enforced through automated workflows:

- **Super-Linter**  
  Ensures consistent coding standards across all supported languages.  

- **Test Automation**  
  Frontend and backend tests run automatically as part of CI. **May temporarily break during frontend/backend changes, as time allows for repair.**  

> CI workflows are iterative and will evolve alongside the project.

---

## Future Features

Planned and exploratory features for upcoming iterations include:

- **Advanced Layer Management**  
  Drag-and-drop layer ordering, opacity controls (coming), and grouping (coming) for complex map compositions.  

- **Custom Projections & Planetary CRS**  
  Support for non-Earth coordinate systems, including custom definitions for Mars and Moon datasets.  

- **Raster Analysis Tools**  
  On-the-fly slope, hillshade, and elevation profiling for planetary DEMs (coming).  

- **Vector Query & Inspection**  
  Feature selection, attribute inspection, and spatial querying directly within the map view (coming).  

- **Time-Aware Data Visualization**  
  Support for temporal layers and animated map playback (coming).  

- **Pluggable Data Sources**  
  Modular backend connectors for XYZ, and cloud-hosted (coming) GIS services.  

- **Integrated AI Assistance**  
  Plain-language AI assistance for intelligent, automated layer creation (coming).  

> Features will be implemented incrementally.

---

## Project Direction

Current areas of active development include:

- ~~Expanding planetary basemap and CRS support.~~ done.
- Improving automated test coverage for map interactions.  
- ~~Refining CI workflows for faster developer feedback~~ done.
- Experimenting with additional spatial data formats and services.  

> I'm looking for **steady, visible improvement** rather than rapid feature expansion.

---

## Directory Structure

This project is organized into separate frontend and backend components:
```text
gazawayj-gis-webview/
Directory structure:
└── gazawayj-gis-webview/
    ├── README.md
    ├── backend/
    │   ├── package.json
    │   ├── server.js
    │   └── src/
    │       ├── server.spec.ts
    │       └── test-setup.ts
    ├── frontend/
    │   ├── angular.json
    │   ├── eslint.config.js
    │   ├── index.html
    │   ├── package.json
    │   ├── tsconfig.app.json
    │   ├── tsconfig.eslint.json
    │   ├── tsconfig.json
    │   ├── tsconfig.spec.json
    │   ├── vitest.config.ts
    │   ├── .editorconfig
    │   ├── public/
    │   │   └── _headers
    │   └── src/
    │       ├── index.html
    │       ├── main.ts
    │       ├── papaparse.d.ts
    │       ├── server.ts
    │       ├── styles.css
    │       ├── test-setup.ts
    │       ├── test.ts
    │       ├── app/
    │       │   ├── app.component.css
    │       │   ├── app.component.html
    │       │   ├── app.component.ts
    │       │   ├── app.css
    │       │   ├── app.html
    │       │   ├── app.module.ts
    │       │   ├── app.spec.ts
    │       │   └── map/
    │       │       ├── layer-item.component.css
    │       │       ├── layer-item.component.html
    │       │       ├── layer-item.component.ts
    │       │       ├── map-constants.ts
    │       │       ├── map.component.css
    │       │       ├── map.component.html
    │       │       ├── map.component.spec.ts
    │       │       ├── map.component.ts
    │       │       └── services/
    │       │           ├── layer-manager.service.ts
    │       │           ├── map-facade.service.ts
    │       │           ├── style.service.ts
    │       │           ├── symbol-constants.ts
    │       │           └── unique-symbol.service.ts
    │       ├── assets/
    │       │   └── tiles/
    │       │       ├── earth/
    │       │       │   ├── active-fires.geojson
    │       │       │   └── layers.json
    │       │       ├── mars/
    │       │       │   └── layers.json
    │       │       └── moon/
    │       │           └── layers.json
    │       └── environments/
    │           ├── environment.prod.ts
    │           └── environment.ts
    └── .github/
        └── workflows/
            ├── build-back.yml
            ├── build-front.yml
            ├── deployToIO.yml
            ├── super-linter-back.yml
            ├── super-linter-front.yml
            ├── tests-backend.yml
            └── tests-frontend.yml
```

---

<p align="center">
  Built and maintained by <strong>Jim Gazaway</strong>
</p>
