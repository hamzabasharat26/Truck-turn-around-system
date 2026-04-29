Truck Turnaround System (Real-Time YOLO Analysis)

This is a major update. The application no longer reads from events.json. It now runs a real-time OpenCV/YOLO script in the background and streams the live video and events to the dashboard.

CRITICAL: Local Setup Instructions

1. Install New Python Libraries

You MUST install new libraries for this to work.

# This will install Flask, SocketIO, OpenCV, and YOLOv8
pip install -r requirements.txt


This is the same as running:
pip install flask flask-socketio eventlet opencv-python-headless ultralytics fpdf2

2. Add Required Files

You must place these files in the main project folder (the same folder as app.py):

dock.mp4 (Your input video file)

yolov8n.pt (The standard YOLO model file)

best.pt (Your custom-trained YOLO model file)

3. Run the Application

Run the app using the app.py script.

python app.py


You will see Starting Flask-SocketIO server.... Open http://127.0.0.1:5000 in your browser.

How to Use

Log in (admin / 123).

Go to the Operations dashboard.

Click the new "Start Analysis" button.

The "Live Video Feed" will appear and start streaming the processed video from your dock.mp4 file.

The "Live Event Feed" and "Live Turnaround Timeline" widgets will update in real-time, step-by-step, as your script detects events.

Click "Stop Analysis" to stop the stream.

Deployment Warning

PythonAnywhere: Free accounts cannot run this. This new version requires threading and SocketIO streaming, which are too advanced for the free tier.

Azure: This can be deployed to Azure, but it requires a more complex setup (e.t., Azure Web App for Containers) to handle the background worker and SocketIO.