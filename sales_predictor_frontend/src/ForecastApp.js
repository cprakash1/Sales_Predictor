// src/ForecastApp.js
import React, { useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";

const ForecastApp = () => {
  const [file, setFile] = useState(null);
  const [dateCol, setDateCol] = useState("");
  const [valueCol, setValueCol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || !dateCol || !valueCol) {
      setError("Please provide all inputs.");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("date_col", dateCol);
    formData.append("value_col", valueCol);

    try {
      const response = await axios.post(
        "https://sales-predictor-n89m.onrender.com/forecast",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log(response);
      const resultBlob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      saveAs(resultBlob, "forecast.json");
    } catch (err) {
      setError("Error fetching forecast data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Forecast Application</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="file">Upload CSV file:</label>
          <input
            type="file"
            id="file"
            accept=".csv"
            onChange={handleFileChange}
          />
        </div>
        <div>
          <label htmlFor="date_col">Date Column Name:</label>
          <input
            type="text"
            id="date_col"
            value={dateCol}
            onChange={(e) => setDateCol(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="value_col">Value Column Name:</label>
          <input
            type="text"
            id="value_col"
            value={valueCol}
            onChange={(e) => setValueCol(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Get Forecast"}
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default ForecastApp;
