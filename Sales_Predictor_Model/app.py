from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import itertools
import numpy as np
import statsmodels.api as sm
import io
import os

app = Flask(__name__)
CORS(app)  # Allow CORS for all origins

def read_data(file, date_col, value_col):
    df = pd.read_csv(file)
    df[date_col] = pd.to_datetime(df[date_col])
    df = df[[date_col, value_col]].sort_values(date_col)
    df.set_index(date_col, inplace=True)
    return df

def preprocess_data(df):
    y = df.resample('MS').mean()
    return y

def train_model(y):
    p = d = q = range(0, 2)
    pdq = list(itertools.product(p, d, q))
    seasonal_pdq = [(x[0], x[1], x[2], 12) for x in list(itertools.product(p, d, q))]

    best_aic = float("inf")
    best_pdq = None
    best_seasonal_pdq = None

    for param in pdq:
        for param_seasonal in seasonal_pdq:
            try:
                mod = sm.tsa.statespace.SARIMAX(y, order=param, seasonal_order=param_seasonal, enforce_stationarity=False, enforce_invertibility=False)
                result = mod.fit()
                if result.aic < best_aic:
                    best_aic = result.aic
                    best_pdq = param
                    best_seasonal_pdq = param_seasonal
            except:
                continue
     
    model = sm.tsa.statespace.SARIMAX(y, order=best_pdq, seasonal_order=best_seasonal_pdq)
    result = model.fit()
    
    return result

def forecast(result, steps=120):
    pred_uc = result.get_forecast(steps=steps)
    pred_ci = pred_uc.conf_int()
    
    pred_ci['Predicted Value'] = pred_uc.predicted_mean
    pred_ci = pred_ci[['Predicted Value']]
    
    return pred_ci

@app.route('/forecast', methods=['POST'])
def forecast_endpoint():
    if 'file' not in request.files or 'date_col' not in request.form or 'value_col' not in request.form:
        return jsonify({"error": "Missing file or parameters"}), 400
    
    file = request.files['file']
    date_col = request.form['date_col']
    value_col = request.form['value_col']
    
    try:
        # Read and process the file
        df = read_data(file, date_col, value_col)
        y = preprocess_data(df)
        result = train_model(y)
        pred_ci = forecast(result, steps=120)

        # Convert prediction to JSON
        forecast_data = pred_ci.reset_index().to_json(orient="records", date_format="iso")
        
        # Filter past data to include only relevant columns
        past_df = df.reset_index()[[date_col, value_col]]
        
        
        # Convert past data to JSON
        past_data = past_df.to_json(orient="records", date_format="iso")
        
        response = {
            "past": past_data,
            "predicted": forecast_data
        }

        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))  # Default to port 5000 if not set
    app.run(host='0.0.0.0', port=port, debug=False)
