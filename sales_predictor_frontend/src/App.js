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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
  const [model, setModel] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleDateColChange = (e) => {
    setDateCol(e.target.value);
  };

  const handleValueColChange = (e) => {
    setValueCol(e.target.value);
  };

  const handleSubmit = async (selectedModel) => {
    setLoading(true);
    setModel(selectedModel);
    setData([]);
    setPastData([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("date_col", dateCol);
    formData.append("value_col", valueCol);

    try {
      const response = await axios.post(
        // `https://sales-predictor-n89m.onrender.com/forecast/${selectedModel}`,
        `https://api-deployment-d7fy.onrender.com/forecast/${selectedModel}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 300000, // Set timeout to 5 minutes (300000 ms)
        }
      );

      const parsedData = response.data;

      const forecastData = JSON.parse(parsedData.predicted);
      const pastDataRaw = JSON.parse(parsedData.past);

      const monthlyData = aggregateMonthlyData(pastDataRaw);

      setData(forecastData);
      setPastData(monthlyData);
    } catch (error) {
      console.error("Error fetching forecast data:", error);
      alert(
        "An error occurred: " + (error.response?.data?.error || error.message)
      );
    } finally {
      setLoading(false);
    }
  };

  const aggregateMonthlyData = (data) => {
    const groupedData = {};

    data.forEach((item) => {
      const date = new Date(item["Order Date"]);
      const month = date.getFullYear() + "-" + (date.getMonth() + 1);

      if (!groupedData[month]) {
        groupedData[month] = [];
      }
      groupedData[month].push(item["Sales"]);
    });

    const monthlyData = Object.keys(groupedData).map((month) => {
      const values = groupedData[month];
      const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        "Order Date": new Date(month + "-01").toISOString().split("T")[0],
        Sales: meanValue,
      };
    });

    return monthlyData;
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Forecast");
    XLSX.writeFile(wb, "forecast.xlsx");
  };

  const setTestData = async () => {
    try {
      const response = await fetch("/input.csv");
      const csvText = await response.text();

      const blob = new Blob([csvText], { type: "text/csv" });

      const file = new File([blob], "input.csv", { type: "text/csv" });

      setFile(file);
      setDateCol("Order Date");
      setValueCol("Sales");
    } catch (error) {
      console.error("Error fetching or processing file:", error);
    }
  };

  const downloadPDF = () => {
    const chartElement = document.getElementById("chart");
    html2canvas(chartElement).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF();
      pdf.text("Forecast Report", 20, 10);
      pdf.text(`Model Used: ${model}`, 20, 20);
      pdf.text("Chart:", 20, 30);
      pdf.addImage(imgData, "PNG", 10, 40, 190, 100); // Adjust size and position
      pdf.save("report.pdf");
    });
  };

  // Prepare data for the chart
  const chartData = {
    labels: pastData
      .concat(data.map((item) => ({ "Order Date": item["index"] })))
      .map((item) => item["Order Date"]),
    datasets: [
      {
        label: "Past Data",
        data: pastData.map((item) => ({
          x: item["Order Date"], // Use 'Order Date' for x values
          y: item["Sales"], // Use 'Sales' for y values
        })),
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        fill: true,
      },
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

  // Find the minimum and maximum dates from pastData and data
  const allDates = pastData
    .map((item) => new Date(item["Order Date"]))
    .concat(data.map((item) => new Date(item["index"])));
  const minDate = new Date(Math.min.apply(null, allDates));
  const maxDate = new Date(Math.max.apply(null, allDates));

  const options = {
    scales: {
      x: {
        type: "time", // Set x-axis to time scale
        time: {
          unit: "month", // Adjust the unit to month
          tooltipFormat: "MMM yyyy", // Format tooltip as "Month Year"
          displayFormats: {
            month: "MMM yyyy", // Display format for months
          },
        },
        min: minDate,
        max: maxDate,
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
      <h1 className="app-header">Sales Data Uploader</h1>
      <form className="upload-form">
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
        <div className="button-group">
          <button
            type="button"
            className="submit-button"
            disabled={loading}
            onClick={() => handleSubmit("sarima")}
          >
            {loading && model === "sarima" ? "Processing..." : "Submit SARIMA"}
          </button>
          <button
            type="button"
            className="submit-button"
            disabled={loading}
            onClick={() => handleSubmit("holt-winters")}
          >
            {loading && model === "holt-winters"
              ? "Processing..."
              : "Submit Holt-Winters"}
          </button>
          <button
            type="button"
            className="submit-button"
            disabled={loading}
            onClick={() => setTestData()}
          >
            Set Test Data
          </button>
        </div>
      </form>

      {loading && (
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      )}

      {data.length > 0 && (
        <div className="results-container">
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
            <button onClick={downloadPDF} className="download-button">
              Download Graph
            </button>
          </div>
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
                  <td>{row["index"].split("T")[0]}</td>
                  <td>{row["Predicted Value"]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="chart-container" id="chart">
            <h2>Data Chart</h2>
            <Line data={chartData} options={options} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
