import json
import os
import io
import csv
import cv2  # Added for OpenCV
import time
from flask import (
    Flask, render_template, jsonify, request, redirect, url_for, flash,
    Response, session, g, send_file
)
from flask_socketio import SocketIO, emit
from io import BytesIO
from datetime import datetime, timezone
from functools import wraps
from fpdf import FPDF
import threading # Added for background tasks
import traceback # For detailed error printing

# --- App & SocketIO Setup ---
app = Flask(__name__)
app.secret_key = 'your_strong_secret_key_here_12345!@#'
socketio = SocketIO(app, async_mode='threading')

# --- Global variables for analysis state ---
analysis_thread = None
stop_analysis_flag = threading.Event()

# --- File Paths ---
CONFIG_FILE = 'config.json'
EVENTS_FILE = 'events.json' # Path for your events.json

# --- Login Decorator ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in_user' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Configuration ---
def set_config_path(path):
    global CONFIG_FILE, EVENTS_FILE
    CONFIG_FILE = os.path.join(path, 'config.json')
    EVENTS_FILE = os.path.join(path, 'events.json') # Set full path

def load_config():
    if not os.path.exists(CONFIG_FILE):
        default_config = {
            "sla_threshold": 45,
            "idle_alert_threshold": 10,
            "cost_per_idle_minute": 2.5,
            "camera_url_1": "",
            "gate_rfid_url": "",
            "users": [{"name": "admin", "role": "Admin"}]
        }
        save_config(default_config)
        return default_config
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {"users": [], "sla_threshold": 45, "idle_alert_threshold": 10, "cost_per_idle_minute": 2.5}

def save_config(config_data):
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config_data, f, indent=2)
    except IOError as e:
        print(f"ERROR: Could not write to config.json: {e}")

# --- Real-time YOLO Analysis Function (MODIFIED Text Drawing) ---
def run_yolo_analysis():
    global stop_analysis_flag
    print("Starting YOLO analysis thread...")
    stop_analysis_flag.clear()

    try:
        # === Open local video ===
        cap = cv2.VideoCapture("static/dockk.mp4")
        if not cap.isOpened():
            print("❌ Error: Could not open dock.mp4.")
            socketio.emit('analysis_error', {'message': 'Error: Could not open dock.mp4. File missing?'})
            return

        start_frame = 320
        end_frame = 4220
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        print(f"Starting analysis from frame {start_frame + 1}")
        frame_count = start_frame

        # === Frame-event mapping ===
        events = {
            321: "Docking Area Empty", 325: "Traffic Light Green", 501: "Traffic Light turned Yellow",
            577: "Traffic Light turned Red", 611: "Truck Arrived at Facility", 631: "Truck Backing Off (Outdoor)",
            821: "Truck Stopped at Gate (Outdoor)", 1156: "A Worker Spotted (Indoor)", 1240: "Worker Pressed the Button",
            (1241, 1315): "Docking Gate Opening", (1382, 1467): "Door Level Extending",
            (1502, 1550): "Worker Lowering the Buffer", (2300, 2510): "Forklift Unloading the Truck",
            (2540, 2590): "Truck is being Unloaded", (2591, 2603): "Truck is Empty Now",
            2625: "Worker Appears Again", 3000: "Truck Doors Released", 3035: "Truck Doors Closed",
            3108: "1st Buffer Back to Home Position", 3202: "2nd Buffer Back to Home Position",
            3227: "Worker Appears", 3283: "Worker Leveled Dock", 3386: "Worker Lock Door",
            (3680, 3775): "Dock Door is being Closed", 3681: "Dock Door Closed Now",
            3849: "Traffic Light turned Red", 4045: "Traffic Light turned Green", 4220: "Truck Left the Docking Facility"
        }

        triggered_events_set = set()
        triggered_events_list = []

        while not stop_analysis_flag.is_set():
            ret, frame = cap.read()

            if not ret or frame_count >= end_frame:
                if frame_count >= end_frame:
                    print(f"Reached end frame {end_frame}. Stopping analysis.")
                else:
                    print("Video stream ended unexpectedly.")
                break # Exit the loop

            frame_count += 1

            # --- Event Emission Logic ---
            for key, event_name in events.items():
                is_triggered = False
                if isinstance(key, tuple):
                    if key[0] <= frame_count <= key[1]: is_triggered = True
                else:
                    if frame_count == key: is_triggered = True

                if is_triggered and event_name not in triggered_events_set:
                    triggered_events_set.add(event_name)
                    triggered_events_list.append(event_name) # Keep adding to list

                    event_data = {
                        'event_name': event_name,
                        'timestamp': datetime.now(timezone.utc).isoformat(),
                        'truck_id': 'truck_001'
                    }
                    if event_name == "Truck Arrived at Facility":
                        event_data['truck_data'] = {
                            'id': 'truck_001', 'license_plate': 'BI CD 8008',
                            'driver_name': 'Jimmy', 'bay': 'Bay 1'
                        }
                    socketio.emit('new_event', event_data)

            # --- *** MODIFIED Text Drawing Logic *** ---
            y_offset = 15    # Start even higher
            line_height = 15   # Smaller line height
            font_scale = 0.3  # Even smaller font size
            start_x = 8      # Slightly less padding
            bg_opacity = 0.6
            text_color = (0, 255, 255) # Bright Yellow

            # Display ALL triggered events
            events_to_display = triggered_events_list

            for i, event in enumerate(events_to_display):
                y_pos = y_offset + (i * line_height)
                # Check if the next line would go off the bottom of the frame
                if y_pos > frame.shape[0] - line_height:
                    break # Stop drawing if it won't fit

                text = f"- {event}"
                (text_w, text_h), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)

                # Define rectangle coordinates, ensuring they stay within bounds
                rect_start_y = max(0, y_pos - text_h - baseline + 1)
                rect_end_y = min(frame.shape[0], y_pos + baseline) # Adjusted bottom boundary
                rect_start_x = max(0, start_x)
                rect_end_x = min(frame.shape[1], start_x + text_w + 8) # Reduced padding

                # Draw background rectangle if coordinates are valid
                if rect_end_y > rect_start_y and rect_end_x > rect_start_x:
                    sub_img = frame[rect_start_y:rect_end_y, rect_start_x:rect_end_x]
                    black_rect = cv2.resize(sub_img, (rect_end_x - rect_start_x, rect_end_y - rect_start_y))
                    black_rect[:] = (0, 0, 0)
                    res = cv2.addWeighted(sub_img, 1 - bg_opacity, black_rect, bg_opacity, 1.0)
                    frame[rect_start_y:rect_end_y, rect_start_x:rect_end_x] = res

                    # Draw text
                    cv2.putText(frame, text,
                                (start_x + 4, y_pos), # Adjusted text padding
                                cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_color, 1, cv2.LINE_AA)
            # --- End of Modified Text Drawing ---

            # --- Stream the frame ---
            (flag, encodedImage) = cv2.imencode(".jpg", frame)
            if not flag: continue

            yield(b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' +
                  bytearray(encodedImage) + b'\r\n')
            
            # --- MODIFIED SLEEP ---
            # Increased from 0.02 to 0.04 to make the video playback slower
            socketio.sleep(0.04) 

        # --- Cleanup ---
        print("Stopping YOLO analysis thread (reached end or user stop).")
        cap.release()
        socketio.emit('analysis_stopped') # Emit stopped signal

    # --- Error Handling ---
    except FileNotFoundError as e:
        print(f"❌ FATAL ERROR: {e}. A model file (yolov8n.pt, best.pt) or dock.mp4 is missing.")
        socketio.emit('analysis_error', {'message': f'File not found: {e.filename}. Make sure models and video are in the project folder.'})
    except Exception as e:
        print(f"❌ Error in analysis thread: {e}")
        traceback.print_exc()
        socketio.emit('analysis_error', {'message': f'An error occurred: {e}'})

# --- (Rest of your app.py remains the same) ---
# ... (Video Route, SocketIO Handlers, Login, Pages, API, Exports, etc.) ...
# --- Video Streaming Route ---
@app.route('/video_feed')
@login_required
def video_feed():
    return Response(run_yolo_analysis(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

# --- SocketIO Event Handlers ---
@socketio.on('connect')
def handle_connect():
    if 'logged_in_user' not in session: return False
    print('Client connected')
    emit('message', {'data': 'Connected to real-time server!'})

@socketio.on('start_analysis')
def handle_start_analysis():
    if 'logged_in_user' not in session: return False
    global analysis_thread
    # Start analysis only if not already running
    # The actual video stream starts when /video_feed is requested by the client
    if analysis_thread is None or not analysis_thread.is_alive():
        print("Received start signal. Client should now request video feed.")
        emit('analysis_started') # Signal client to update <img> src
    else:
        print("Analysis already running.")
        emit('analysis_error', {'message': 'Analysis is already in progress.'})


@socketio.on('stop_analysis')
def handle_stop_analysis():
    if 'logged_in_user' not in session: return False
    global stop_analysis_flag
    print("Received stop signal. Setting stop flag.")
    stop_analysis_flag.set() # Signal the analysis thread to stop

# --- Login & Session Management ---
@app.before_request
def load_logged_in_user():
    g.user = session.get('logged_in_user', None)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form.get('username') == 'admin' and request.form.get('password') == '123':
            session['logged_in_user'] = 'admin'
            #flash('Welcome, admin!', 'success')
            return redirect(url_for('operations_dashboard'))
        else:
            flash('Invalid username or password.', 'error')
            return redirect(url_for('login'))
    if 'logged_in_user' in session:
        return redirect(url_for('operations_dashboard'))
    return render_template('login.html', title='Login')

@app.route('/logout')
def logout():
    session.pop('logged_in_user', None)
    flash('You have been logged out.', 'success')
    return redirect(url_for('login'))

# --- Page Routes (Protected) ---
@app.route('/')
@login_required
def operations_dashboard():
    config = load_config()
    return render_template('index.html', title='Operations Dashboard (Live)', config=config)

@app.route('/supervisor')
@login_required
def supervisor_dashboard():
    config = load_config()
    today_date = datetime.now().strftime('%Y-%m-%d')
    return render_template(
        'supervisor.html', title='Supervisor Dashboard (Summary)',
        SLA_TURNAROUND_MINUTES=config.get('sla_threshold', 45),
        today_date=today_date, config=config
    )

@app.route('/executive')
@login_required
def executive_dashboard():
    config = load_config()
    return render_template('executive.html', title='Executive Dashboard (KPIs)', config=config)

@app.route('/admin', methods=['GET', 'POST'])
@login_required
def admin_panel():
    config = load_config()
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'save_settings':
            config['sla_threshold'] = request.form.get('sla-threshold', 45, type=int)
            config['idle_alert_threshold'] = request.form.get('idle-alert', 10, type=int)
            config['cost_per_idle_minute'] = request.form.get('cost-idle', 2.5, type=float)
            config['camera_url_1'] = request.form.get('cam-input', '')
            config['gate_rfid_url'] = request.form.get('gate-rfid', '')
            save_config(config)
            flash('Settings saved successfully!', 'success')
        elif action == 'add_user':
            user_name, user_role = request.form.get('user-name'), request.form.get('user-role')
            if user_name and user_role:
                 if not any(u['name'] == user_name for u in config.get('users', [])):
                     config.setdefault('users', []).append({'name': user_name, 'role': user_role})
                     save_config(config)
                     flash('User added successfully!', 'success')
                 else:
                     flash(f'User "{user_name}" already exists.', 'warning')
            else:
                flash('User name and role are required.', 'error')
        return redirect(url_for('admin_panel'))
    return render_template('admin.html', title='Admin Panel', config=config)

@app.route('/admin/remove_user/<user_name>')
@login_required
def remove_user(user_name):
    config = load_config()
    if user_name.lower() == 'admin':
        flash('Cannot remove the primary "admin" user.', 'error')
        return redirect(url_for('admin_panel'))
    initial_len = len(config.get('users', []))
    config['users'] = [user for user in config.get('users', []) if user['name'] != user_name]
    if len(config.get('users', [])) < initial_len:
        save_config(config)
        flash(f'User "{user_name}" removed successfully.', 'success')
    else:
        flash(f'User "{user_name}" not found.', 'warning')
    return redirect(url_for('admin_panel'))

# --- API ROUTE TO LOAD STATIC JSON DATA ---
@app.route('/api/static_data')
@login_required
def get_static_data():
    try:
        with open(EVENTS_FILE, 'r') as f:
            data = json.load(f)
        liveTrucks = {}
        allEvents = []
        for truck in data.get('trucks', []):
            truck_id = truck.get('id')
            if not truck_id: continue
            truck_data = {
                'id': truck_id, 'license_plate': truck.get('license_plate'),
                'driver_name': truck.get('driver_name'), 'bay': truck.get('bay'),
                'events': {}, 'status': 'Departed',
            }
            for event in truck.get('events', []):
                event_name, timestamp = event.get('event'), event.get('timestamp')
                if not event_name or not timestamp: continue
                truck_data['events'][event_name] = timestamp
                if event_name == "Truck Arrived at Facility":
                    truck_data['gate_in'] = timestamp
                allEvents.append({
                    'event_name': event_name, 'timestamp': timestamp, 'truck_id': truck_id,
                    'truck_data': {'id': truck_id, 'license_plate': truck.get('license_plate'), 'driver_name': truck.get('driver_name'), 'bay': truck.get('bay')}
                })
            liveTrucks[truck_id] = truck_data
        return jsonify({"liveTrucks": liveTrucks, "allEvents": allEvents})
    except FileNotFoundError:
        print(f"❌ ERROR: {EVENTS_FILE} not found.")
        return jsonify({"error": f"{EVENTS_FILE} not found."}), 404
    except Exception as e:
        print(f"❌ Error processing {EVENTS_FILE}: {e}")
        traceback.print_exc()
        return jsonify({"error": "Error processing static data."}), 500

# --- MODIFIED Export Routes ---
@app.route('/export/csv')
@login_required
def export_csv():
    try:
        with open(EVENTS_FILE, 'r') as f: data = json.load(f)
        si = io.StringIO()
        writer = csv.writer(si)
        writer.writerow(['Truck ID', 'License Plate', 'Bay', 'Event', 'Timestamp'])
        for truck in data.get('trucks', []):
            truck_id, plate, bay = truck.get('id', 'N/A'), truck.get('license_plate', 'N/A'), truck.get('bay', 'N/A')
            for event in truck.get('events', []):
                writer.writerow([truck_id, plate, bay, event.get('event', 'N/A'), event.get('timestamp', 'N/A')])
        output = si.getvalue()
        return Response(output, mimetype="text/csv", headers={"Content-disposition": "attachment; filename=events_report.csv"})
    except Exception as e:
        print(f"❌ Error exporting CSV: {e}"); traceback.print_exc(); flash("Could not generate CSV report.", "error"); return redirect(url_for('admin_panel'))

@app.route('/export/pdf')
@login_required
def export_pdf():
    try:
        with open(EVENTS_FILE, 'r') as f: data = json.load(f)
        pdf = FPDF()
        pdf.add_page(); pdf.set_font('Helvetica', 'B', 16); pdf.cell(0, 10, 'Truck Turnaround Report', 0, 1, 'C'); pdf.ln(5)
        for truck in data.get('trucks', []):
            pdf.set_font('Helvetica', 'B', 12); pdf.cell(0, 10, f"Truck: {truck.get('id')} ({truck.get('license_plate')}) - Bay: {truck.get('bay')}", 0, 1)
            pdf.set_font('Helvetica', '', 10)
            for event in truck.get('events', []):
                timestamp_str, event_str = str(event.get('timestamp', 'N/A')), str(event.get('event', 'N/A'))
                line = f"  - [{timestamp_str}] {event_str}".encode('latin-1', 'replace').decode('latin-1')
                pdf.cell(0, 7, line, 0, 1)
            pdf.ln(3)
        pdf_output = pdf.output(dest='S')
        if isinstance(pdf_output, str): pdf_output = pdf_output.encode('latin-1')
        return send_file(BytesIO(pdf_output), mimetype='application/pdf', as_attachment=True, download_name="events_report.pdf")
    except Exception as e:
        print(f"❌ Error exporting PDF: {e}"); traceback.print_exc(); flash("Could not generate PDF report.", "error"); return redirect(url_for('admin_panel'))

# --- WSGI Configuration ---
project_path = os.path.dirname(os.path.abspath(__file__))
set_config_path(project_path)

@app.before_request
def set_app_root_path():
    app.root_path = project_path

# --- Main Runner ---
if __name__ == '__main__':
    print("Starting Flask-SocketIO server at http://127.0.0.1:5000")
    socketio.run(app, debug=False, host='0.0.0.0', port=8080)