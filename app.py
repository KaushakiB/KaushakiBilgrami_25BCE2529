from flask import Flask, render_template, send_from_directory

app = Flask(__name__)

# Serve the main HTML page
@app.route('/')
def index():
    return render_template('index.html')

# Serve static files (CSS, JS)
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)