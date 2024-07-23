from flask import Flask, request, jsonify
import pandas as pd
import itertools
import statsmodels.api as sm
import io

app = Flask(__name__)

def read_data(file, date_col, value_col):
    df = pd.read_csv(file)
    df[date_col] = pd.to_datetime(df[date_col])
    df = df[[date_col, value_col]].sort_values(date_col)
    df.set_index(date_col, inplace=True)
    return df

def preprocess_data(df, freq='MS'):
    # Resample to specified frequency
    y = df.resample(freq).mean()
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

def forecast(result, steps=30):
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
        df = read_data(file, date_col, value_col)
        y = preprocess_data(df)
        result = train_model(y)
        pred_ci = forecast(result, steps=120)

        result_json = pred_ci.reset_index().to_json(orient="records", date_format="iso")

        return jsonify(result_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/dayforecast', methods=['POST'])
def dayforecast_endpoint():
    if 'file' not in request.files or 'date_col' not in request.form or 'value_col' not in request.form:
        return jsonify({"error": "Missing file or parameters"}), 400
    
    file = request.files['file']
    date_col = request.form['date_col']
    value_col = request.form['value_col']
    
    try:
        df = read_data(file, date_col, value_col)
        y = preprocess_data(df, freq='D')  # Use daily frequency
        result = train_model(y)
        pred_ci = forecast(result, steps=30)  # Forecasting for the next 30 days

        result_json = pred_ci.reset_index().to_json(orient="records", date_format="iso")

        return jsonify(result_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
