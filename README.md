# InsightUBC

A full-stack web application for querying UBC course sections and room data.

## Prerequisites

- Node.js
- Yarn

## Installation

```bash
yarn install
```

## Starting the Server

```bash
yarn start
```

The server will start on port 4321.

## Starting the Frontend

Once the server is running, open your browser and go to: http://localhost:4321

## Using the Application

### Uploading a Dataset

1. Enter a dataset ID (no underscores, no whitespace only)
2. Select the dataset type (Sections or Rooms)
3. Choose a ZIP file
4. Click **Upload**

For Sections, use `pair.zip` from the course resources.
For Rooms, use `campus.zip` from the course resources.

### Viewing Datasets

All successfully added datasets are displayed in the **Added Datasets** table, showing the dataset ID, kind, and number of rows.

### Deleting a Dataset

Click the **Delete** button next to a dataset in the **Added Datasets** table to remove it.

### Querying a Dataset

1. Enter a valid JSON query in the **Query Dataset** text box
2. Click **Run Query**
3. Results will be displayed in a table below

### UBC Buildings Map

1. Upload a Rooms dataset (campus.zip)
2. Click **Show Buildings on Map**
3. All UBC buildings will be displayed on the map
4. Click on a marker to see the building name

## Running Tests

```bash
yarn test
```

## Building the Project

```bash
yarn build
```

## Stopping the Server

Press `Ctrl + C` in the terminal to stop the server.