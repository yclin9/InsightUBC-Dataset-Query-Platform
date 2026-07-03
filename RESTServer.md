# InsightUBC REST Server Documentation

## Base URL
`http://localhost:4321`

---

## Endpoints

### [PUT] /dataset/:id/:kind
Adds a new dataset to the system.

**URL Parameters:**
- `id`: The dataset identifier (no underscores, no whitespace only)
- `kind`: The dataset type (`sections` or `rooms`)

**Request Body:**
- `content`: base64 encoded string of the zip file

**Sample Response (200 OK):**
```json
{
    "result": ["sections", "rooms"]
}
```

**Error Response (400 Bad Request):**
```json
{
    "error": "Dataset already exist"
}
```

---

### [GET] /datasets
Returns a list of all added datasets.

**Sample Response (200 OK):**
```json
{
    "result": [
        {
            "id": "sections",
            "kind": "sections",
            "numRows": 64612
        },
        {
            "id": "rooms",
            "kind": "rooms",
            "numRows": 364
        }
    ]
}
```

---

### [DELETE] /dataset/:id
Removes a dataset from the system.

**URL Parameters:**
- `id`: The dataset identifier to remove

**Sample Response (200 OK):**
```json
{
    "result": "sections"
}
```

**Error Response (404 Not Found):**
```json
{
    "error": "Can't find the id"
}
```

**Error Response (400 Bad Request):**
```json
{
    "error": "Invalid id: id cannot include underscore"
}
```

---

### [POST] /query
Performs a query on an added dataset.

**Request Body:**
The query object following the InsightUBC query EBNF.

**Sample Request Body:**
```json
{
    "WHERE": {
        "GT": {
            "sections_avg": 90
        }
    },
    "OPTIONS": {
        "COLUMNS": ["sections_dept", "sections_avg"],
        "ORDER": "sections_avg"
    }
}
```

**Sample Response (200 OK):**
```json
{
    "result": [
        {
            "sections_dept": "cpsc",
            "sections_avg": 90.02
        }
    ]
}
```

**Error Response (400 Bad Request):**
```json
{
    "error": "Dataset not found"
}
```

---

### [GET] /buildings
Returns a list of all buildings with their geolocation for map display.

**Sample Response (200 OK):**
```json
{
    "result": [
        {
            "rooms_shortname": "DMP",
            "rooms_fullname": "Hugh Dempster Pavilion",
            "rooms_lat": 49.26125,
            "rooms_lon": -123.24807
        }
    ]
}
```

**Error Response (400 Bad Request):**
```json
{
    "error": "Dataset not found"
}
```