<div id="top">

<!-- HEADER STYLE: COMPACT -->
<img src="images/markdown_notes.png" width="50%" align="center" style="margin-right: 15px">

# Zurabase

<!-- BADGES -->
<img src="https://img.shields.io/github/actions/workflow/status/jomakori/zurabase/1-staging.yml?branch=staging&label=Deploy%20Staging&style=flat" alt="Deploy Staging">
<img src="https://img.shields.io/github/actions/workflow/status/jomakori/zurabase/2-production.yml?label=Release%20Production&style=flat" alt="Release Production">

<img src="https://img.shields.io/github/last-commit/jomakori/zurabase?style=flat-square&logo=git&logoColor=white&color=0080ff" alt="last-commit">
<img src="https://img.shields.io/github/languages/top/jomakori/zurabase?style=flat-square&color=0080ff" alt="repo-top-language">
<img src="https://img.shields.io/github/languages/count/jomakori/zurabase?style=flat-square&color=0080ff" alt="repo-language-count">

<em>Built with these tools and technologies:</em>

<img src="https://img.shields.io/badge/JSON-000000.svg?style=flat-square&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/semanticrelease-494949.svg?style=flat-square&logo=semantic-release&logoColor=white" alt="semanticrelease">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=flat-square&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/Autoprefixer-DD3735.svg?style=flat-square&logo=Autoprefixer&logoColor=white" alt="Autoprefixer">
<img src="https://img.shields.io/badge/PostCSS-DD3A0A.svg?style=flat-square&logo=PostCSS&logoColor=white" alt="PostCSS">
<img src="https://img.shields.io/badge/Prettier-F7B93E.svg?style=flat-square&logo=Prettier&logoColor=black" alt="Prettier">
<img src="https://img.shields.io/badge/.ENV-ECD53F.svg?style=flat-square&logo=dotenv&logoColor=black" alt=".ENV">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat-square&logo=JavaScript&logoColor=black" alt="JavaScript">
<br>
<img src="https://img.shields.io/badge/Go-00ADD8.svg?style=flat-square&logo=Go&logoColor=white" alt="Go">
<img src="https://img.shields.io/badge/React-61DAFB.svg?style=flat-square&logo=React&logoColor=black" alt="React">
<img src="https://img.shields.io/badge/Docker-2496ED.svg?style=flat-square&logo=Docker&logoColor=white" alt="Docker">
<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat-square&logo=TypeScript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/GitHub%20Actions-2088FF.svg?style=flat-square&logo=GitHub-Actions&logoColor=white" alt="GitHub%20Actions">
<img src="https://img.shields.io/badge/Vite-646CFF.svg?style=flat-square&logo=Vite&logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/CSS-663399.svg?style=flat-square&logo=CSS&logoColor=white" alt="CSS">
<img src="https://img.shields.io/badge/Jest-C21325.svg?style=flat-square&logo=Jest&logoColor=white" alt="Jest">
<img src="https://img.shields.io/badge/MongoDB-47A248.svg?style=flat-square&logo=MongoDB&logoColor=white" alt="MongoDB">

## Overview

This repository hosts a modular monolith application with two main features: a markdown notes app and a planner board system, both built with a Go backend and a Node.js (React/TypeScript) frontend. The application allows users to create, edit, and share both markdown notes and interactive planning boards.


![Frontend](./images/demo.gif)

The backend uses MongoDB to store notes and planner data, with a comprehensive API for both features.

## Features

### Markdown Notes
- **Markdown Support**: The application supports markdown editing, allowing users to format their notes with ease.
- **Image Handling**: Users can include images in their notes, enhancing the visual aspect of their content.
- **Sharing Capabilities**: Notes can be shared with others, promoting collaboration. No account creation needed to create, view and share notes.

### Planner Boards
- **Kanban and Scrum Templates**: Create planning boards with predefined templates for Kanban or Scrum methodologies.
- **Customizable Lanes**: Create, reorder, and color-code lanes to organize your tasks.
- **Card Management**: Add cards to lanes with customizable fields, move cards between lanes, and reorder them.
- **Split Lane Functionality**: Split existing lanes to create new organizational structures.
- **Markdown Export**: Export your planner board as a structured markdown document.
- **Drag and Drop Interface**: Intuitive drag-and-drop interface for moving cards and lanes.
- **Real-time Updates**: Changes are automatically saved as you work.

## Getting Started

### Prerequisites

This project requires the following dependencies:

- **Programming Language:** TypeScript, Go
- **Package Manager:** NPM, Go
- **Secrets Manager:** Doppler
- **Container Runtime:** Docker
- **Database:** MongoDB
- **Testing:** Pre-commit, Devbox

## Developing locally

You can run the api and ui together using `docker-compose`:

```bash
make up
```

The backend API will be available at [http://localhost:8080/](http://localhost:8080/) and the frontend at [http://localhost:8181/](http://localhost:8181/).

## Testing

Like in CI, we'll utilize devbox to perform tests in an isolated env:

```bash
# Test Frontend
devbox run test_fe

# Test Backend
devbox run test_be

```

## API Endpoints

### Notes API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/note/:id` | Retrieve a note by ID |
| POST | `/note` | Create a new note (or update an existing one) |
| GET | `/images/:query` | Search for images by using the [Pexels API](https://www.pexels.com/api/) |

### Planner API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/planner` | Create a new planner board |
| GET | `/planner/:id` | Retrieve a planner board by ID |
| PUT | `/planner/:id` | Update a planner board's title and description |
| DELETE | `/planner/:id` | Delete a planner board |
| GET | `/planner/templates` | Get available planner templates |
| GET | `/planner/:id/export` | Export a planner as markdown |
| POST | `/planner/import` | Import a planner from markdown |
| POST | `/planner/:id/lane` | Add a new lane to a planner |
| PUT | `/planner/:id/lane/:laneId` | Update a lane |
| DELETE | `/planner/:id/lane/:laneId` | Delete a lane |
| POST | `/planner/:id/lane/:laneId/split` | Split a lane into two |
| POST | `/planner/:id/lane/:laneId/card` | Add a card to a lane |
| PUT | `/planner/:id/lane/:laneId/card/:cardId` | Update a card |
| DELETE | `/planner/:id/lane/:laneId/card/:cardId` | Delete a card |
| POST | `/planner/:id/card/:cardId/move` | Move a card to a different lane |
| POST | `/planner/:id/lanes/reorder` | Reorder lanes |
| POST | `/planner/:id/lane/:laneId/cards/reorder` | Reorder cards in a lane |

## Contributing
- **🐛 [Report Issues](https://github.com/jomakori/zurabase/issues)**: Submit bugs found or log feature requests for the `zurabase` project.
- **💡 [Submit Pull Requests](https://github.com/jomakori/zurabase/pulls)**: Review open PRs, and submit your own PRs.

### Contributing Guidelines
<details>
<summary>More info</summary>

1. **Clone the Repository**: Start by cloning the repo
   ```sh
   git clone https://github.com/jomakori/zurabase
   ```
2. **Create a New Branch**: Always work on a new branch, giving it a descriptive name.
   ```sh
   git checkout -b <initials>/<new-feature-x>
   ```
3. **Make Your Changes**: Develop and test your changes locally.
4. **Commit/Push Your Changes**: make continuous commits of your changes to your branch
   ```sh
   git commit -m 'feat(category): <insert commit message>'
   git push origin <initials>/<new-feature-x>
   ```
5. **Submit a `WIP` Pull Request and point it to `staging`**: Fill out the template and make sure its pointing to `staging`
   ```sh
   git commit -m 'feat(category): <insert commit message>'
   gh pr create --base staging --head <your-branch-name>
   ```
6. **Test/Deploy to Staging**:
   - Once the PR has been reviewed and approved - merge into `staging` to trigger testing
   - When tests pass - changes are deployed to `staging`
   - The `Release` PR is auto-generated - w/ the same content as the `WIP` PR
7. **Release changes to PROD:**
   - Confirm changes on `staging`
   - If changes look good - merge the `Release` PR to `main` - which will deploy changes to `Production`
</details>

### Contributors
<br>
<p align="left">
   <a href="https://github.com{/jomakori/zurabase/}graphs/contributors">
      <img src="https://contrib.rocks/image?repo=jomakori/zurabase">
   </a>
</p>
