<p align="center">
# GIS WebView

Interactive browser-based GIS platform for planetary-scale visualization and experimentation.  

**Live Demo:** [gazawayj.github.io/](https://gazawayj.github.io/)

---

## Application Status

| Frontend | Backend |
|:--:|:--:|
| <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml/badge.svg" /></a> |
| <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml/badge.svg" /></a> |
| <a href="https://github.com/gazawayj/gis-webview/actions/workflows/tests-frontend.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/tests-frontend.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/tests-backend.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/tests-backend.yml/badge.svg" /></a> |

---

## Purpose

GIS WebView is designed to explore modern techniques for **interactive planetary GIS** in the browser. It emphasizes:

- Planetary basemaps and non-Earth coordinate systems  
- Standards-compliant spatial data (GeoJSON, CSV, XYZ tiles)  
- Fast, interactive visualization with layer management  
- A foundation for AI-assisted geospatial workflows  

This platform is intended to be a foundation for professional GIS development.

---

## Capabilities

- Multi-planet support (Earth, Mars, Moon)  
- Vector and raster layer rendering  
- Interactive layer management with planned drag-and-drop, opacity, and grouping controls  
- Temporal data visualization and animation (planned)  
- Plain-language AI-assisted layer creation (planned)  
- Browser-native, standards-compliant spatial formats  

---

## System Architecture

```
Frontend  → Angular + OpenLayers web client
Backend   → Node.js GIS services and API
Data      → GeoJSON, CSV, XYZ tiles, planetary datasets
CI/CD     → GitHub Actions: build, lint, tests
```

The frontend handles visualization and interaction, while the backend serves GIS-friendly formats and map tiles. All components are designed for modularity and extensibility.

---

## Technology Stack

[![Tech Stack](https://skillicons.dev/icons?i=github,js,html,css,py,nodejs,angular,ts)](https://skillicons.dev)

- Angular  
- OpenLayers  
- Node.js / Express  
- TypeScript  
- GitHub Actions  
- GeoJSON, CSV, XYZ tile services  

---

## Directory Structure

High-level layout of the repository:

```
gazawayj-gis-webview/
├── backend/       Node.js API and GIS services
│   └── assets/tiles
├── frontend/      Angular web client + OpenLayers
│   └── src/app/map
└── .github/       CI/CD workflows
```

---

## Development Roadmap

Current and planned improvements:

- Drag-and-drop layer ordering, grouping, and opacity controls  
- Advanced planetary projections and CRS support  
- Raster analysis tools (slope, hillshade, elevation profiling)  
- Temporal layers and animated map playback  
- Integration of AI-assisted GIS workflows  

---

## Author
</p>

Jim Gazaway  
Greeley, CO  
[GitHub](https://github.com/gazawayj) | [Email](mailto:gazawayj@gmail.com)
