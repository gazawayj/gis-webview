# GIS WebView

A modern web application for interactive geospatial visualization and experimentation.

**Live at:** [https://gazawayj.github.io/](https://gazawayj.github.io/)  
*(Temporarily limited due to backend updates. Still visible, but non-functional for a few days.)*

---

## Application Status

| Category | Frontend | Backend |
|:--|:--:|:--:|
| **Build** | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml/badge.svg" /></a> |
| **Lint** | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml/badge.svg" /></a> |
| **Tests** | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/tests-frontend.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/tests-frontend.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/tests-backend.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/tests-backend.yml/badge.svg" /></a> |

---

## Technology Stack

[![Tech Stack](https://skillicons.dev/icons?i=js,html,css,webpack,py,nodejs,github,angular,anaconda)](https://skillicons.dev)

---

## Overview

**GIS WebView** is an evolving geospatial web platform designed to explore modern patterns for GIS visualization directly in the browser.

The project focuses on rendering planetary-scale spatial data. Raster imagery, vector layers, and tiled map services—using **Angular** and **OpenLayers**. The frontend provides interactive mapping, layer management, and user controls, while the backend serves GIS-friendly formats such as **GeoJSON**, raster metadata (coming soon), and map tiles.

This project serves both as:

- A learning project for creating a modern web-based GIS, usable for planetary and exo-planetary investigations.
- A foundation for a more complete, extensible GIS visualization system utilizing AI-assistance.

---

## Key Features

- **Planetary Basemap Support**  
  Early support for Earth, Mars, and Moon datasets.  

- **Automated Quality Control**  
  CI pipelines powered by GitHub Actions handle builds, linting, and tests.  

- **Optimized Frontend Bundling**  
  Webpack-based build.  

- **Standards-Based Spatial Formats**  
  Support for GeoJSON.

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
  Drag-and-drop layer ordering (soon), opacity controls (coming), and grouping (coming) for complex map compositions.  

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

-- - Expanding planetary basemap and CRS support. -- done.
- Improving automated test coverage for map interactions.  
-- - Refining CI workflows for faster developer feedback. -- done.
- Experimenting with additional spatial data formats and services.  

> I'm looking for **steady, visible improvement** rather than rapid feature expansion.

---

<p align="center">
  Built and maintained by <strong>Jim Gazaway</strong>
</p>
