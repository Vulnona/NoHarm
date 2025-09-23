
import datetime
import random
import socket
import sqlite3

from flask import Flask, render_template, request, redirect, session, Response, jsonify

from api_call import send_post_request
import logging




# create flask function for structural testing
def create_app():
    app = Flask(__name__)
    app.secret_key = 'secret_key'  # Secret key for session management

    # Set the logging level
    app.logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    app.logger.addHandler(handler)
    return app

# create flask app object
app = create_app()

# Connect to the database
def get_db_connection():
    try:
        conn = sqlite3.connect('database.db')
        conn.row_factory = sqlite3.Row
        app.logger.info('db connection established')
        return conn
    except:
        app.logger.error('db connection failed')
        return None


# Middleware to ensure the language is set for each page
@app.before_request
def set_language():
    try:
        if 'language' not in session:
            session['language'] = 'en'  # Default language is English
            app.logger.info('default language set to english')
        else:
            app.logger.info('session language set to {}'.format(session['language']))
    except:
        if not session:
            app.logger.error('session not found')



# Function to get random images for choice experiments
def get_random_images(total_images, selected_images):
    available_images = [i for i in range(1, total_images + 1) if i not in selected_images]
    return random.sample(available_images, 2)

# Add a function to get user location info (optional)
def get_user_location():
    try:
        # This is a simplified example - you might want to use a geolocation API
        ip = request.remote_addr
        hostname = socket.gethostbyaddr(ip)[0] if ip != '127.0.0.1' else 'localhost'
        app.logger.info('session ip recorded')
        return {
            'ip_address': ip,
            'city': 'Unknown',
            'region': 'Unknown',
            'country': 'Unknown'
        }

    except:
        app.logger.warning('session ip unknown')
        return {
            'ip_address': 'Unknown',
            'city': 'Unknown',
            'region': 'Unknown',
            'country': 'Unknown'
        }



# Home route to display the intro page
@app.route('/')
def intro():
    app.logger.info('rendering main page')
    return render_template('intro.html', language=session.get('language'))


# Route to change language
@app.route('/change-language', methods=['POST'])
def change_language():
    language = request.form.get('language')
    session['language'] = language
    app.logger.info('language changed to {}'.format(session['language']))
    return redirect(request.referrer)  # Redirect back to the page the user was on


# Modify the submit route to store initial session data
@app.route('/submit', methods=['POST'])
def submit():
    consent = request.form.get('consent')
    if consent == 'yes':
        # Insert a new row into the database for the new user
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get user location info
        try:
            ip = request.remote_addr
            ip_address = ip if ip else 'Unknown'
        except:
            ip_address = 'Unknown'
        
        # Record session start time
        session_start = datetime.datetime.now().isoformat() if 'datetime' in globals() else None
        
        # Check if language column exists
        cursor.execute("PRAGMA table_info(user_responses);")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'language' in columns:
            # If language column exists, include it
            cursor.execute('''
                INSERT INTO user_responses 
                (session_start, ip_address, language) 
                VALUES (?, ?, ?)
            ''', (
                session_start, 
                ip_address,
                session.get('language', 'en')
            ))
        else:
            # Otherwise just insert without language
            cursor.execute('''
                INSERT INTO user_responses 
                (session_start, ip_address) 
                VALUES (?, ?)
            ''', (
                session_start, 
                ip_address
            ))
        
        session['user_id'] = cursor.lastrowid
        conn.commit()
        conn.close()

        # Reset session variables for the new survey
        session['selected_images'] = []
        session['current_page'] = 1
        session['popup_shown'] = False
        session.pop('stored_images', None)

        app.logger.info('session data recorded by consent in db')
        return redirect('/choice-experiment')
    else:
        app.logger.warning('session data not consented')
        return redirect('/no-consent')


IMAGES = [
    {"id": 1, "filename": "child_simple.jpg", "description": "Child"},
    {"id": 2, "filename": "Disability.jpg", "description": "Person with Disability"},
    {"id": 3, "filename": "old_male_female_simpler.jpg", "description": "Elderly Couple"},
    {"id": 4, "filename": "Overweight_simpler.jpg", "description": "Overweight Person"},
    {"id": 5, "filename": "test_0_0_1_1_0.jpg", "description": "Test Image 1"},
    {"id": 6, "filename": "test_0_0_2_3_1.jpg", "description": "Test Image 2"},
    {"id": 7, "filename": "test_0_2_3_3_2.jpg", "description": "Test Image 3"},
    {"id": 8, "filename": "test_1_0_3_2_0.jpg", "description": "Test Image 4"},
    {"id": 9, "filename": "test_1_3_2_2_1.jpg", "description": "Test Image 5"},
    {"id": 10, "filename": "Patient_at_Laptop_with_Head_Bandage.png", "description": "Patient at Laptop with Head Bandage"},
    {"id": 11, "filename": "Patient_on_a_Stretcher.png", "description": "Patient on a Stretcher"},
    {"id": 12, "filename": "Patient_with_Arm_Sling.png", "description": "Patient with Arm Sling"},
    {"id": 13, "filename": "Patient_with_IV_and_Arm_Sling.jpg", "description": "Patient with IV and Arm Sling"},
    {"id": 14, "filename": "Patient_with_IV_Drip.png", "description": "Patient with IV Drip"},
    {"id": 15, "filename": "pregnant_woman_care.webp", "description": "Pregnant Woman Care"},
    {"id": 16, "filename": "Pregnant_woman_lying_on_hospital_bed.png", "description": "Pregnant Woman Lying on Hospital Bed"},
    {"id": 17, "filename": "Walking_Patient_with_Crutches.jpg", "description": "Walking Patient with Crutches"}
]


# Update the filename paths to use the resized directory
for image in IMAGES:
    image["filename"] = f"resized_images/{image['filename']}"



@app.route('/choice-experiment', methods=['GET', 'POST'])
def choice_experiment():
    if 'user_id' not in session:
        app.logger.info('session: user id not set')
        return redirect('/')
    else:
        app.logger.info('session: user id set to '+ str(session['user_id']))

    # Initialize session variables only once
    if 'reconsider_set' not in session:
        session['reconsider_set'] = random.randint(1, 3)
        session['selected_images'] = []
        session['initial_choices'] = []
        session['final_choices'] = []
        session['stored_images'] = None
        session['current_images'] = None
        session['popup_shown'] = False
        session['awaiting_final_selection'] = False
    else:
        app.logger.info('session: reconsider_set set to ' + str(session['reconsider_set']))

    # Check if we've already completed 3 choices
    if len(session.get('selected_images', [])) >= 3:
        app.logger.info('image selection tests concluded')
        return redirect('/procedural-ratings')
    else:
        app.logger.info('image selection test ongoing')

    if request.method == 'POST':
        selected_image = request.form.get('selected_image')
        current_set = len(session.get('selected_images', [])) + 1
        app.logger.info('POST request initiated')
        
        # Handle final selection after reconsider popup
        if session.get('awaiting_final_selection', False):
            # This is the final selection after the reconsider popup
            session['awaiting_final_selection'] = False
            
            # Store this as the final choice
            session.setdefault('final_choices', []).append(selected_image)
            
            # Add to selected images to move to next set
            session.setdefault('selected_images', []).append(selected_image)
            session.modified = True
            
            # Get initial choice for this set
            initial_choice = session['initial_choices'][-1]
            
            # Update database with both initial and final choices
            conn = get_db_connection()
            conn.execute(f'''
                UPDATE user_responses
                SET choice{current_set} = ?,
                    choice{current_set}_initial = ?,
                    choice{current_set}_final = ?
                WHERE id = ?
            ''', (selected_image, initial_choice, selected_image, session['user_id']))
            conn.commit()
            conn.close()
            app.logger.info('db updated with both initial and final choices')
            return jsonify({'show_reconsider': False})
        
        # Handle initial selection
        # Store the initial choice
        session.setdefault('initial_choices', []).append(selected_image)
        session.modified = True  # Mark session as modified

        # Check if current set is the reconsider set and popup hasn't been shown
        if current_set == session['reconsider_set'] and not session.get('popup_shown', False):
            session['popup_shown'] = True
            session.modified = True  # Mark session as modified
            
            other_image = session['current_images'][1] if session['current_images'][0] == selected_image else session['current_images'][0]
            session['data_driven_tool_suggestion'] = other_image
            
            # Get descriptions for both images
            original_desc = next((img['description'] for img in IMAGES if img['filename'].split('/')[-1] == selected_image.split('/')[-1]), "Unknown")
            suggestion_desc = next((img['description'] for img in IMAGES if img['filename'] == other_image), "Unknown")
            app.logger.info('initial image selection recorded')
            return jsonify({
                'show_reconsider': True,
                'original': selected_image,
                'suggestion': other_image,
                'original_desc': original_desc,
                'suggestion_desc': suggestion_desc
            })
        
        # Normal selection (not the reconsider set)
        # Update selected images list and move to next set
        session.setdefault('selected_images', []).append(selected_image)
        session.modified = True

        # Update database
        conn = get_db_connection()
        conn.execute('''
            UPDATE user_responses
            SET choice{0} = ?,
                choice{0}_initial = ?,
                choice{0}_final = ?
            WHERE id = ?
        '''.format(current_set), (selected_image, selected_image, selected_image, session['user_id']))
        conn.commit()
        conn.close()
        app.logger.info('db initialised with both initial and final choices')
        return jsonify({'show_reconsider': False})
    elif request.method == 'GET':
        # Handle GET request
        available_images = [img for img in IMAGES if img["filename"] not in session.get('selected_images', [])]
        images = random.sample(available_images, 2)
        session['current_images'] = [img["filename"] for img in images]
        app.logger.info('GET request initiated')
        app.logger.info('rendered choice experiment successfully with selected images')
        return render_template('choice_experiment.html',
                             images=images,
                             current_set=len(session.get('selected_images', [])) + 1)
    else:
        app.logger.error('POST/GET request not found')
        app.logger.error(str(request.method) + ' request initiated')
        return jsonify({'error': 'Invalid request '+str(request.method)}), 400


@app.route('/reconsider', methods=['POST'])
def reconsider():
    data = request.get_json()
    if not data or 'change_decision' not in data:
        app.logger.error('invalid data error')
        return jsonify({'error': 'Invalid data'}), 400
    else:
        app.logger.info('valid data: ' + str(data))

    # Check for required session data
    required_session_keys = ['reconsider_set', 'data_driven_tool_suggestion', 'initial_choices', 'user_id']
    if any(key not in session for key in required_session_keys):
        app.logger.error('session data missing')
        return jsonify({'error': 'Session data missing'}), 400
    else:
        app.logger.info('valid session data: ' + str(session))

    changed_decision = data['change_decision']
    current_set = session['reconsider_set']
    
    # Store the user's decision about changing their choice
    session['changed_decision'] = changed_decision
    session.modified = True
    
    # Get selected choice based on user decision
    suggested_choice = session['data_driven_tool_suggestion']
    initial_choice = session['initial_choices'][-1]
    
    # Set a flag to indicate that we're waiting for the final selection
    session['awaiting_final_selection'] = True
    session.modified = True

    # Update database with the reconsideration data
    conn = get_db_connection()
    try:
        conn.execute(f'''
            UPDATE user_responses
            SET data_driven_tool_suggestion = ?,
                changed_decision = ?
            WHERE id = ?
        ''', (suggested_choice, changed_decision, session['user_id']))
        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        app.logger.error('db connection error: '+ str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

    app.logger.info('reconsider popup successful')
    return jsonify({'success': True})


@app.route('/procedural-ratings', methods=['GET', 'POST'])
def procedural_ratings():
    # List of questions with short IDs, labels, and full descriptions
    questions = [
        {
            "id": "save_life_years",
            "label": "Save the most life years",
            "full_text": "Save the most life years: prioritize those who have the most life years left after overcoming the disease; i.e., treat younger patients first."
        },
        {
            "id": "advantage_disadvantaged",
            "label": "Provide advantage to the disadvantaged",
            "full_text": "Provide advantage to the disadvantaged: prioritize those who are worse off than others; i.e., treat sickest patients first."
        },
        {
            "id": "benefit_future",
            "label": "Benefit to others in the future",
            "full_text": "Benefit to others in the future: Prioritize those who are likely to make relevant contributions to the benefit of others; i.e., treat patients who have children or are planning to have children."
        },
        {
            "id": "first_come",
            "label": "First-come, first-served",
            "full_text": "First-come, first-served: Prioritize those who were first in line; i.e., treat patients who arrived first at the hospital."
        },
        {
            "id": "treatment_success",
            "label": "Maximize treatment success",
            "full_text": "Maximize treatment success: Prioritize those with the highest probability of survival after treatment; i.e., treat patients with the highest chance of recovery."
        },
        {
            "id": "treatment_effort",
            "label": "Minimize treatment effort",
            "full_text": "Minimize treatment effort: Prioritize those who will be cured with minimum effort; i.e., treat patients who need the least medication."
        },
        {
            "id": "medication_effect",
            "label": "Maximize the medication effect",
            "full_text": "Maximize the medication effect: Prioritize those where the improvement per medication is highest; i.e., treat patients who benefit most from a given medication."
        },
        {
            "id": "random_selection",
            "label": "Random selection",
            "full_text": "Random selection: Treatment should be allocated by random lottery; i.e., individual characteristics should not be considered."
        },
    ]

    if request.method == 'POST':
        question_id = request.form.get('question_id')
        rating = request.form.get('rating')

        # Save the response to the database
        conn = get_db_connection()

        # Ensure user ID exists
        if 'user_id' not in session:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO user_responses DEFAULT VALUES')
            session['user_id'] = cursor.lastrowid
            conn.commit()
        else:
            app.logger.info('session user_id set to {}'.format(session['user_id']))

        # Store the response for the current question
        conn.execute(f'''
            UPDATE user_responses
            SET {question_id} = ?
            WHERE id = ?
        ''', (rating, session['user_id']))
        conn.commit()
        conn.close()
        app.logger.info('current ratings Q&A stored')

        # Move to the next question
        current_index = next((i for i, q in enumerate(questions) if q['id'] == question_id), -1)
        next_index = current_index + 1

        # Redirect to the next section if all questions are answered
        if next_index >= len(questions):
            app.logger.info('all ratings Q&A done, now moving on to user instructions')
            return redirect('/instructions')
        else:
            app.logger.info('ratings Q&A continued')

        # Redirect to the next question
        app.logger.info('next rating question')
        return redirect(f'/procedural-ratings?index={next_index}')
    else:
        app.logger.info('POST request not found')
        app.logger.info(str(request.method) + ' request initiated')

    # Get the current question based on the index in the query parameter
    current_index = int(request.args.get('index', 0))
    if current_index >= len(questions):
        return redirect('/instructions')  # Redirect to next section if all are answered
    else:
        app.logger.info('ratings Q&A cntd..')
    question = questions[current_index]

    app.logger.info('user procedural ratings successfully rendered')
    return render_template('procedural_ratings.html', question=question, index=current_index)



@app.route('/instructions', methods=['GET', 'POST'])
def instructions():
    if request.method == 'POST':
        # Once the user is ready, redirect them to the demography page.
        app.logger.info('redirected to demography page')
        return redirect('/demography')
    elif request.method == 'GET':
        app.logger.info('instruction page successfully rendered')
        return render_template('instructions.html')
    else:
        app.logger.error('POST/GET request not found')
        app.logger.error(str(request.method) + ' request initiated')
        return jsonify({'error': 'Invalid request ' + str(request.method)}), 400



@app.route('/demography', methods=['GET', 'POST'])
def demography():
    # List of demographic questions with short IDs and full labels
    questions = [
        {
            "id": "gender",
            "label": "What describes you best?",
            "type": "radio",
            "options": [
                {"value": "female", "label": "Female"},
                {"value": "male", "label": "Male"},
                {"value": "diverse", "label": "Diverse"},
                {"value": "prefer_not_to_disclose", "label": "Prefer not to disclose"}
            ]
        },
        {
            "id": "age",
            "label": "How old are you?",
            "type": "number",
            "placeholder": "Age (in years)"
        },
        {
            "id": "religion",
            "label": "Do you identify yourself with any of the following religions?",
            "type": "radio",
            "options": [
                {"value": "none", "label": "No, I do not"},
                {"value": "christian", "label": "Christian"},
                {"value": "islam", "label": "Islam"},
                {"value": "hinduism", "label": "Hinduism"},
                {"value": "buddhism", "label": "Buddhism"},
                {"value": "other", "label": "Other"}
            ]
        },
    ]

    if request.method == 'POST':
        # Get the current question's ID and user's response
        question_id = request.form.get('question_id')
        answer = request.form.get('answer')

        # Validate age if the question is about age
        if question_id == "age":
            try:
                age = int(answer)
                if age < 16 or age > 120:
                    app.logger.warning('invalid age error: number beyond scope')
                    return "Invalid age. Please enter a value between 16 and 120.", 400
            except ValueError:
                app.logger.warning('invalid age error: invalid datatype')
                return "Invalid age input. Please enter a number.", 400

        # Save the response to the database immediately
        conn = get_db_connection()

        # Insert a row for this user if it doesn't already exist
        if 'user_id' not in session:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO user_responses DEFAULT VALUES')
            session['user_id'] = cursor.lastrowid
            conn.commit()

        # Update the specific demographic response
        if question_id in ['gender', 'age', 'religion']:
            conn.execute(f'''
                UPDATE user_responses
                SET {question_id} = ?
                WHERE id = ?
            ''', (answer, session['user_id']))
            conn.commit()
        conn.close()

        # Move to the next question
        current_index = next((i for i, q in enumerate(questions) if q['id'] == question_id), -1)
        next_index = current_index + 1

        # If all questions are answered, redirect to the next section
        if next_index >= len(questions):
            app.logger.info('redirected to group preferences')
            return redirect('/group-preferences')

        # Redirect to the next question
        app.logger.info('move onto next question within demography')
        return redirect(f'/demography?index={next_index}')
    elif request.method == 'GET':
        # Get the current question based on the index in the query parameter
        current_index = int(request.args.get('index', 0))
        question = questions[current_index]
        app.logger.info('demography page successfully rendered')
        return render_template('demography.html', question=question, index=current_index)
    else:
        app.logger.error('POST/GET request not found')
        app.logger.error(str(request.method) + ' request initiated')
        return jsonify({'error': 'Invalid request ' + str(request.method)}), 400


@app.route('/group-preferences', methods=['GET', 'POST'])
def group_preferences():
    # List of group preference questions with short IDs and full labels
    questions = [
        {
            "id": "general_health",
            "label": "How is your health in general?",
            "type": "gradient",
            "options": ["Very Poor", "Poor", "Fair", "Good", "Very Good", "Excellent"]
        },
        {
            "id": "illness",
            "label": "Have you been severely ill in the last year?",
            "type": "radio",
            "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]
        },
        {
            "id": "children",
            "label": "Do you have children or are you planning to have children?",
            "type": "radio",
            "options": [{"value": "yes", "label": "Yes"}, {"value": "no", "label": "No"}]
        }
    ]

    if request.method == 'POST':
        # Get the current question's ID and user's response
        question_id = request.form.get('question_id')
        answer = request.form.get('answer')

        # Prevent empty submissions
        if not answer:
            app.logger.warning('group preference has an empty submission')
            return redirect(f'/group-preferences?index={request.form.get("current_index")}')

        # Save the response to the database
        conn = get_db_connection()

        if 'user_id' not in session:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO user_responses DEFAULT VALUES')
            session['user_id'] = cursor.lastrowid
            conn.commit()

        conn.execute(f'''
            UPDATE user_responses
            SET {question_id} = ?
            WHERE id = ?
        ''', (answer, session['user_id']))
        conn.commit()
        conn.close()

        # Move to the next question
        current_index = next((i for i, q in enumerate(questions) if q['id'] == question_id), -1)
        next_index = current_index + 1

        # Redirect to the thank-you page if all questions are answered
        if next_index >= len(questions):
            app.logger.info('survey successfully completed')
            return redirect('/thank-you')
        app.logger.info('move onto next question within group preferences')
        return redirect(f'/group-preferences?index={next_index}')
    elif request.method == 'GET':
        # Get the current question based on the index in the query parameter
        current_index = int(request.args.get('index', 0))

        # Prevent index out of range
        if current_index >= len(questions):
            app.logger.info('survey successfully completed')
            return redirect('/thank-you')

        question = questions[current_index]
        app.logger.info('group preferences page successfully rendered')
        return render_template('group_preferences.html', question=question, index=current_index)
    else:
        app.logger.error('POST/GET request not found')
        app.logger.error(str(request.method) + ' request initiated')
        return jsonify({'error': 'Invalid request ' + str(request.method)}), 400



# Modify the thank-you route to store session end time
@app.route('/thank-you')
def thank_you():
    # Record session end time
    if 'user_id' in session:
        conn = get_db_connection()
        session_end = datetime.datetime.now().isoformat()
        conn.execute('''
            UPDATE user_responses
            SET session_end = ?
            WHERE id = ?
        ''', (session_end, session['user_id']))
        conn.commit()
        conn.close()

        # mock api call after survey completion sending the last row of the user input in the user_responses table
        # check mock api output : https://webhook.site/#!/view/c4f75040-f408-45b0-8d99-44bca147ba58
        conn_read = get_db_connection()
        cursor = conn_read.cursor()
        data_string = cursor.execute('''
                                     SELECT *
                                     FROM user_responses
                                     ORDER BY id DESC LIMIT 1;
                                     ''').fetchone()
        print(data_string)
        send_post_request('https://webhook.site/c4f75040-f408-45b0-8d99-44bca147ba58', data_string)
        conn_read.close()
    else:
        app.logger.warning('session: user_id not set in session')
    app.logger.info('survey recorded and final thank you page rendered successfully')
    return render_template('thank_you.html', language=session.get('language'))

# Route for no consent page
@app.route('/no-consent')
def no_consent():
    app.logger.warning('session data not consented')
    return render_template('no_consent.html', language=session.get('language'))


# Route for admin login
@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        password = request.form.get('password')
        if password == 'admin':
            session['admin'] = True
            app.logger.info('admin: survey results sheet')
            return redirect('/results')
        else:
            app.logger.warning('admin: incorrect password')
            return "Incorrect password. Try again."
    elif request.method == 'GET':
        app.logger.info('admin: login page rendered and language set successfully')
        return render_template('admin_login.html', language=session.get('language'))
    else:
        app.logger.error('POST/GET request not found')
        app.logger.error(str(request.method) + ' request initiated')
        return jsonify({'error': 'Invalid request ' + str(request.method)}), 400


@app.route('/results')
def results():
    if 'admin' in session:
        try:
            # Connect to the database
            conn = get_db_connection()

            # Check if the `user_responses` table exists
            conn.execute("SELECT 1 FROM user_responses LIMIT 1;")

            # Fetch all user responses
            user_responses = conn.execute('SELECT * FROM user_responses').fetchall()
            conn.close()

            # Render the results page with user responses

            return render_template('results.html', user_responses=user_responses)

        except sqlite3.OperationalError as e:
            # Handle the case where the table does not exist
            if "no such table" in str(e):
                app.logger.error('user table not found error:'+str(e))
                return "Error: The 'user_responses' table does not exist. Please ensure the database is initialized.", 500
            else:
                app.logger.error('db error:' + str(e))
                return f"Database error: {str(e)}", 500
    else:
        # If the user is not logged in as admin, redirect to admin login
        app.logger.warning('user not logged in, redirecting to admin login')
        return redirect('/admin')


@app.route('/download-csv')
def download_csv():
    if 'admin' in session:
        # Connect to the database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get column names
        cursor.execute("PRAGMA table_info(user_responses);")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Get all data
        cursor.execute(f"SELECT {', '.join(columns)} FROM user_responses")
        user_responses = cursor.fetchall()
        conn.close()

        # Prepare the CSV content
        def generate_csv():
            # Create a CSV output
            output = []
            # Write header row (column names)
            output.append(",".join([key for key in user_responses[0].keys()]))

            # Write each row
            for row in user_responses:
                output.append(",".join([str(row[key]) for key in row.keys()]))
            app.logger.info('user response recorded for csv')
            return "\n".join(output)

        # Generate the CSV content
        csv_content = generate_csv()

        # Create a Response object for the CSV file
        response = Response(csv_content, mimetype='text/csv')
        response.headers.set("Content-Disposition", "attachment", filename="survey_results.csv")
        app.logger.info('csv successfully generated')
        return response
    else:
        app.logger.warning('user not logged in, redirecting to admin login')
        return redirect('/admin')  # Redirect to admin login if not logged in



# Route to logout admin
@app.route('/logout')
def logout():
    session.pop('admin', None)
    app.logger.warning('logged out, redirecting to admin login')
    return redirect('/admin')

# mock api call without survey completion via an endpoint to send last row of user responses table
# check mock api output : https://webhook.site/#!/view/c4f75040-f408-45b0-8d99-44bca147ba58
@app.route('/mock_api_call')
def webhook_output():
    conn = get_db_connection()
    cursor = conn.cursor()
    data_string = cursor.execute('''
                               SELECT *
                               FROM user_responses
                               ORDER BY id DESC LIMIT 1;
                               ''').fetchone()
    print(data_string)
    send_post_request('https://webhook.site/c4f75040-f408-45b0-8d99-44bca147ba58', data_string)
    conn.close()
    app.logger.warning('(mock) api call successfully recorded at: https://webhook.site/#!/view/c4f75040-f408-45b0-8d99-44bca147ba58')
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True)
