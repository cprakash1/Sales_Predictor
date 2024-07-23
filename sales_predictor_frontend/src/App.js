import React, { useState } from "react";
import axios from "axios";
import { CSVLink } from "react-csv";
import * as XLSX from "xlsx";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "./App.css"; // Import custom CSS for styling
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale, // Register the time scale
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const App = () => {
  const [data, setData] = useState([]);
  const [pastData, setPastData] = useState([]);
  const [file, setFile] = useState(null);
  const [dateCol, setDateCol] = useState("");
  const [valueCol, setValueCol] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleDateColChange = (e) => {
    setDateCol(e.target.value);
  };

  const handleValueColChange = (e) => {
    setValueCol(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("date_col", dateCol);
    formData.append("value_col", valueCol);

    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/forecast",
        // "https://sales-predictor-n89m.onrender.com/forecast",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 300000, // Set timeout to 5 minutes (300000 ms)
        }
      );

      console.log("Response received:", response);

      const parsedData = response.data;
      console.log("Parsed Data:", parsedData);

      setData(JSON.parse(parsedData.predicted));
      setPastData(JSON.parse(parsedData.past));
    } catch (error) {
      console.error("Error fetching forecast data:", error);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Forecast");
    XLSX.writeFile(wb, "forecast.xlsx");
  };

  // Prepare data for the chart
  const chartData = {
    labels: pastData
      .concat(data.map((item) => ({ "Order Date": item["index"] })))
      .map((item) => item["Order Date"]),
    datasets: [
      // {
      //   label: "Past Data",
      //   data: pastData.map((item) => ({
      //     x: item["Order Date"], // Use 'Order Date' for x values
      //     y: item["Sales"], // Use 'Sales' for y values
      //   })),
      //   borderColor: "rgba(75,192,192,1)",
      //   backgroundColor: "rgba(75,192,192,0.2)",
      //   fill: true,
      // },
      {
        label: "Forecast Data",
        data: data.map((item) => ({
          x: item["index"], // Use 'index' for x values
          y: item["Predicted Value"], // Use 'Predicted Value' for y values
        })),
        borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: true,
      },
    ],
  };

  const options = {
    scales: {
      x: {
        type: "time", // Set x-axis to time scale
        time: {
          unit: "day", // Adjust the unit to match your data
        },
        title: {
          display: true,
          text: "Date",
        },
      },
      y: {
        title: {
          display: true,
          text: "Value",
        },
      },
    },
  };

  return (
    <div className="app-container">
      <h1 className="app-header">Forecast Data Uploader</h1>
      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fileInput">Upload CSV File:</label>
          <input
            id="fileInput"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="dateCol">Date Column Name:</label>
          <input
            id="dateCol"
            type="text"
            placeholder="Date Column Name"
            value={dateCol}
            onChange={handleDateColChange}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="valueCol">Value Column Name:</label>
          <input
            id="valueCol"
            type="text"
            placeholder="Value Column Name"
            value={valueCol}
            onChange={handleValueColChange}
            required
          />
        </div>
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? "Processing..." : "Submit"}
        </button>
      </form>

      {data.length > 0 && (
        <div className="results-container">
          <h2>Forecast Data</h2>
          <table className="results-table">
            <thead>
              <tr>
                <th>Index</th>
                <th>Predicted Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td>{row.index}</td>
                  <td>{row["Predicted Value"]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="download-buttons">
            <CSVLink
              data={data}
              headers={[
                { label: "Index", key: "index" },
                { label: "Predicted Value", key: "Predicted Value" },
              ]}
              filename="forecast.csv"
              className="download-button"
            >
              Download CSV
            </CSVLink>
            <button onClick={downloadExcel} className="download-button">
              Download Excel
            </button>
          </div>

          <div className="chart-container">
            <h2>Data Chart</h2>
            <Line data={chartData} options={options} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
