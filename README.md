# GIS WebView

A modern, high-performance web application for interactive geospatial visualization and experimentation.

## Application Status

| Category | Frontend | Backend |
|:--|:--:|:--:|
| **Build** | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/build-back.yml/badge.svg" /></a> |
| **Lint** | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-front.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/super-linter-back.yml/badge.svg" /></a> |
| **Tests** | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/frontend-tests.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/frontend-tests.yml/badge.svg" /></a> | <a href="https://github.com/gazawayj/gis-webview/actions/workflows/backend-tests.yml"><img src="https://github.com/gazawayj/gis-webview/actions/workflows/backend-tests.yml/badge.svg" /></a> |

## Technology Stack

[![Tech Stack](https://skillicons.dev/icons?i=js,html,css,webpack,py,nodejs,github,angular,anaconda)](https://skillicons.dev)

## Overview

**GIS WebView** is an evolving geospatial web platform designed to explore modern patterns for GIS visualization in the browser.

The project focuses on efficiently rendering planetary-scale spatial data—including raster imagery, vector layers, and tiled map services—using **Angular** and **OpenLayers**. The frontend provides interactive mapping, layer management, and user controls, while the backend serves GIS-friendly formats such as **GeoJSON**, raster metadata, and map tiles.

This repository serves both as:

- A hands-on learning environment for modern web-based GIS
- A foundation for a more complete, extensible GIS visualization system

## Key Features

- **Planetary Basemap Support**  
  Early support for Earth, Mars, and Moon datasets.

- **Automated Quality Control**  
  CI pipelines powered by GitHub Actions for builds, linting, and tests.

- **Optimized Frontend Bundling**  
  Webpack-based builds focused on performance, caching, and minimal load times.

- **Standards-Based Spatial Formats**  
  Native support for GeoJSON and common web mapping protocols.

## Continuous Integration

Code quality and stability are enforced through automated workflows:

- **Super-Linter**  
  Ensures consistent coding standards across all supported languages.

- **Test Automation**  
  Frontend and backend tests run automatically as part of CI.

> CI workflows are intentionally iterative and evolve alongside new features.

## Future Features

Planned and exploratory features for upcoming iterations include:

- **Advanced Layer Management**  
  Drag-and-drop layer ordering, opacity controls, and grouping for complex map compositions.
- **Custom Projections & Planetary CRS**  
  First-class support for non-Earth coordinate systems, including custom WKT definitions for Mars and Moon datasets.
- **Raster Analysis Tools**  
  On-the-fly slope, hillshade, and elevation profiling for planetary DEMs.
- **Vector Query & Inspection**  
  Feature selection, attribute inspection, and spatial querying directly within the map view.
- **Time-Aware Data Visualization**  
  Support for temporal layers and animated map playback.
- **Performance Scaling**  
  Improved tile caching, lazy loading, and WebGL acceleration for large datasets.
- **Pluggable Data Sources**  
  Modular backend connectors for WMS, WMTS, XYZ, and cloud-hosted GIS services.

These features will be implemented incrementally, guided by real-world GIS workflows and performance considerations rather than feature volume alone.

## Project Direction

Current areas of active development include:

- **Expanding planetary basemap and CRS support**
- **Improving automated test coverage for map interactions**
- **Refining CI workflows for faster developer feedback**
- **Experimenting with additional spatial data formats and services**

The guiding principle of this project is **steady, visible improvement** rather than rapid feature expansion.

---

<p align="center">
  Built and maintained by <strong>Jim Gazaway</strong>
</p>