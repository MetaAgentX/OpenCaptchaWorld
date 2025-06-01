import os
import json
import random
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

# Dictionary to track which puzzles have been shown for each CAPTCHA type
seen_puzzles = {}
# List to track recently used CAPTCHA types to avoid repetition
recent_types = []
# How many types to remember before allowing repetition
MAX_RECENT_TYPES = 5

PUZZLE_TYPE_SEQUENCE = [
    'Dice_Count',
    'Geometry_Click',
    'Rotation_Match',
    'Slide_Puzzle',
    'Unusual_Detection',
    'Image_Recognition',
    'Bingo',
    'Image_Matching',
    'Patch_Select',
    'Dart_Count',
    'Object_Match',
    'Select_Animal',
    'Coordinates',
    'Path_Finder',
    'Place_Dot',
    'Connect_icon',
    'Click_Order',
    'Hold_Button',
    'Misleading_Click',
    'Pick_Area'
]
sequential_index = 0

# Load ground truth data for a specific type
def load_ground_truth(captcha_type):
    path = os.path.join('captcha_data', captcha_type, 'ground_truth.json')
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

# Get available CAPTCHA types
def get_captcha_types():
    base_dir = 'captcha_data'
    if not os.path.exists(base_dir):
        return []
    return [d for d in os.listdir(base_dir) 
            if os.path.isdir(os.path.join(base_dir, d))]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/captcha_data/<captcha_type>/<filename>')
def serve_captcha(captcha_type, filename):
    return send_from_directory(os.path.join('captcha_data', captcha_type), filename)

@app.route('/captcha_data/<captcha_type>/<subdir>/<filename>')
def serve_captcha_subdir(captcha_type, subdir, filename):
    return send_from_directory(os.path.join('captcha_data', captcha_type, subdir), filename)

@app.route('/api/get_puzzle', methods=['GET'])
def get_puzzle():
    global recent_types
    
    # Check if we should return a random puzzle from any type
    is_random = request.args.get('random', 'false').lower() == 'true'
    
    # Get all available CAPTCHA types
    captcha_types = get_captcha_types()
    if not captcha_types:
        return jsonify({'error': 'No CAPTCHA types found'}), 404
    
    # Check if we're in debug mode for a specific type
    debug_type = request.args.get('debug_type')

    mode = request.args.get('mode', '').lower()

    if debug_type and debug_type in captcha_types:
        puzzle_type = debug_type
    elif not is_random and mode == 'sequential':
        global sequential_index
        puzzle_type = PUZZLE_TYPE_SEQUENCE[sequential_index % len(PUZZLE_TYPE_SEQUENCE)]
        sequential_index += 1
    elif is_random:
        # Select a random CAPTCHA type, avoiding recently used types if possible
        available_types = [t for t in captcha_types if t not in recent_types]
        
        # If all types have been used recently, reset the tracking
        if not available_types:
            recent_types = []
            available_types = captcha_types
        
        puzzle_type = random.choice(available_types)
        
        # Add to recent types and maintain maximum length
        recent_types.append(puzzle_type)
        if len(recent_types) > MAX_RECENT_TYPES:
            recent_types.pop(0)
    else:
        # Get puzzle type from query parameter
        puzzle_type = request.args.get('type', 'Dice_Count')
        # Check if puzzle type exists
        if puzzle_type not in captcha_types:
            return jsonify({'error': f'Invalid puzzle type: {puzzle_type}'}), 400
    
    # Load ground truth for the selected type
    ground_truth = load_ground_truth(puzzle_type)
    if not ground_truth:
        return jsonify({'error': f'No puzzles found for type: {puzzle_type}'}), 404
    
    puzzle_files = list(ground_truth.keys())
    
    # Select a random puzzle, avoiding repetition if possible
    if puzzle_type not in seen_puzzles:
        seen_puzzles[puzzle_type] = set()
    
    # Get unseen puzzles
    unseen_puzzles = [p for p in puzzle_files if p not in seen_puzzles[puzzle_type]]
    
    # If all puzzles have been seen, reset the tracking
    if not unseen_puzzles:
        seen_puzzles[puzzle_type] = set()
        unseen_puzzles = puzzle_files
    
    # Select a random puzzle from unseen ones
    selected_puzzle = random.choice(unseen_puzzles)
    
    # Mark this puzzle as seen
    seen_puzzles[puzzle_type].add(selected_puzzle)
    
    # Get the appropriate question prompt based on puzzle type
    if puzzle_type == "Dice_Count":
        prompt = ground_truth[selected_puzzle].get('prompt', "Sum up the numbers on all the dice")
    elif puzzle_type == "Geometry_Click":
        prompt = ground_truth[selected_puzzle].get("question", "Click on the geometric shape")
    elif puzzle_type == "Rotation_Match":
        prompt = ground_truth[selected_puzzle].get("prompt", "Use the arrows to rotate the object to match the reference direction")
    elif puzzle_type == "Slide_Puzzle":
        prompt = ground_truth[selected_puzzle].get("prompt", "Drag the slider component to the correct position")
    elif puzzle_type == "Unusual_Detection":
        prompt = ground_truth[selected_puzzle].get("prompt", "Select the unusual items in the image")
    elif puzzle_type == "Image_Recognition":
        prompt = ground_truth[selected_puzzle].get("prompt", "Select all images matching the description")
    elif puzzle_type == "Bingo":
        prompt = ground_truth[selected_puzzle].get("prompt", "Please click two images to exchange their position to line up the same images to a line")
    elif puzzle_type == "Image_Matching":
        prompt = ground_truth[selected_puzzle].get("prompt", "Using the arrows, match the animal in the left and right image.")
    elif puzzle_type == "Patch_Select":
        prompt = ground_truth[selected_puzzle].get("prompt", "Select all squares with the specified objects")
    elif puzzle_type == "Dart_Count":
        prompt = ground_truth[selected_puzzle].get("prompt", "Use the arrows to pick the image where all the darts add up to the number in the left image.")
    elif puzzle_type == "Object_Match":
        prompt = ground_truth[selected_puzzle].get("prompt", "Use the arrows to change the number of objects until it matches the left image.")
    elif puzzle_type == "Select_Animal":
        prompt = ground_truth[selected_puzzle].get("prompt", "Pick a fox")
    elif puzzle_type == "Coordinates":
        prompt = ground_truth[selected_puzzle].get("prompt", "Using the arrows, move Jerry to the indicated seat")
    elif puzzle_type == "Path_Finder":
        prompt = ground_truth[selected_puzzle].get("prompt", "Use the arrows to move the duck to the spot indicated by the cross")
    elif puzzle_type == "Place_Dot":
        prompt = ground_truth[selected_puzzle].get("prompt", "Click to place a Dot at the end of the car's path")
    elif puzzle_type == "Connect_icon":
        prompt = ground_truth[selected_puzzle].get("prompt", "Using the arrows, connect the same two icons with the dotted line as shown on the left.")
    elif puzzle_type == "Click_Order":
        prompt = ground_truth[selected_puzzle].get("prompt", "Click the icons in order as shown in the reference image.")
    elif puzzle_type == "Hold_Button":
        prompt = ground_truth[selected_puzzle].get("prompt", "Hold the button until it finishes loading.")
    elif puzzle_type == "Misleading_Click":
        prompt = ground_truth[selected_puzzle].get("prompt", "Click the image to continue.")
    elif puzzle_type == "Pick_Area":
        prompt = ground_truth[selected_puzzle].get("prompt", "Click on the largest area outlined by the dotted line")
    else:
        prompt = ground_truth[selected_puzzle].get("prompt", "Solve the CAPTCHA puzzle")
    
    # Add input_type to tell the frontend what kind of input to show
    input_type = "text"
    if puzzle_type == "Dice_Count":
        input_type = "number"
    elif puzzle_type == "Geometry_Click":
        input_type = "click"
    elif puzzle_type == "Rotation_Match":
        input_type = "rotation"
    elif puzzle_type == "Slide_Puzzle":
        input_type = "slide"
    elif puzzle_type == "Unusual_Detection":
        input_type = "multiselect"
    elif puzzle_type == "Image_Recognition":
        input_type = "image_grid"
    elif puzzle_type == "Bingo":
        input_type = "bingo_swap"
    elif puzzle_type == "Image_Matching":
        input_type = "image_matching"
    elif puzzle_type == "Patch_Select":
        input_type = "patch_select"
    elif puzzle_type == "Dart_Count":
        input_type = "dart_count"
    elif puzzle_type == "Object_Match":
        input_type = "object_match"
    elif puzzle_type == "Select_Animal":
        input_type = "select_animal"
    elif puzzle_type == "Coordinates":
        input_type = "image_matching"
    elif puzzle_type == "Path_Finder":
        input_type = "image_matching"
    elif puzzle_type == "Place_Dot":
        input_type = "place_dot"
    elif puzzle_type == "Connect_icon":
        input_type = "connect_icon"
    elif puzzle_type == "Click_Order":
        input_type = "click_order"
    elif puzzle_type == "Hold_Button":
        input_type = "hold_button"
    elif puzzle_type == "Misleading_Click":
        input_type = "click"
    elif puzzle_type == "Pick_Area":
        input_type = "click"
    
    # For Rotation_Match, include additional data needed for the interface
    additional_data = {}
    if puzzle_type == "Rotation_Match":
        # Get reference image and object base name
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        object_base_image = ground_truth[selected_puzzle].get("object_base_image")
        
        if not reference_image or not object_base_image:
            # If missing required fields, try another puzzle or fall back
            return jsonify({'error': f'Invalid rotation puzzle data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        
        # Get object base name without extension to construct rotated image paths
        object_base = os.path.splitext(object_base_image)[0]
        
        # Construct the initial object image path (0 degrees rotation)
        object_path = f'/captcha_data/{puzzle_type}/{object_base}_0.png'
        
        additional_data = {
            "reference_image": ref_path,
            "object_image": object_path,
            "object_base": object_base,
            "current_angle": 0
        }
    # For Slide_Puzzle, include the component image path and target position data
    elif puzzle_type == "Slide_Puzzle":
        # Get component image name
        component_image = ground_truth[selected_puzzle].get("component_image")
        
        if not component_image:
            # If missing required fields, try another puzzle or fall back
            return jsonify({'error': f'Invalid slide puzzle data: {selected_puzzle}'}), 500
        
        # Format path for the component image
        component_path = f'/captcha_data/{puzzle_type}/{component_image}'
        
        additional_data = {
            "component_image": component_path,
            "background_image": f'/captcha_data/{puzzle_type}/{selected_puzzle}'
        }
    # For Unusual_Detection, include the grid size
    elif puzzle_type == "Unusual_Detection":
        # Get grid size from ground truth
        grid_size = ground_truth[selected_puzzle].get("grid_size", [2, 3])  # Default to 2x3 grid if not specified
        
        additional_data = {
            "grid_size": grid_size
        }
    # For Image_Recognition, include the grid images
    elif puzzle_type == "Image_Recognition":
        # Get images array from ground truth
        images = ground_truth[selected_puzzle].get("images", [])
        grid_size = [3, 3]  # Default grid size for image recognition (3x3)
        
        # Get the subfolder name from the puzzle_id or use a specific subfolder field
        subfolder = ground_truth[selected_puzzle].get("subfolder", selected_puzzle)
        
        # Include image paths in response - dynamically use the subfolder
        image_paths = [f'/captcha_data/{puzzle_type}/{subfolder}/{img}' for img in images]
        
        additional_data = {
            "images": image_paths,
            "grid_size": grid_size,
            "question": ground_truth[selected_puzzle].get("question", "Select matching images")
        }
    # For Bingo, include the grid size
    elif puzzle_type == "Bingo":
        # Get grid size from ground truth
        grid_size = ground_truth[selected_puzzle].get("grid_size", [3, 3])  # Default to 3x3 grid if not specified
        
        additional_data = {
            "grid_size": grid_size,
            "solution_line": ground_truth[selected_puzzle].get("solution_line", {}),
            "answer": ground_truth[selected_puzzle].get("answer", [])
        }
    # For Image_Matching, include the reference image and options
    elif puzzle_type == "Image_Matching":
        # Get the reference image and option images
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        option_images = ground_truth[selected_puzzle].get("option_images", [])
        correct_option_index = ground_truth[selected_puzzle].get("correct_option_index", 0)
        
        if not reference_image or not option_images:
            return jsonify({'error': f'Invalid image matching data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        option_paths = [f'/captcha_data/{puzzle_type}/{img}' for img in option_images]
        
        additional_data = {
            "reference_image": ref_path,
            "option_images": option_paths,
            "current_option_index": 0,
            "correct_option_index": correct_option_index
        }
    # For Patch_Select, include the grid size and target object
    elif puzzle_type == "Patch_Select":
        # Get grid size from ground truth, default to 6x6 grid
        grid_size = ground_truth[selected_puzzle].get("grid_size", [5, 5])
        target_object = ground_truth[selected_puzzle].get("target_object", "moon")
        correct_patches = ground_truth[selected_puzzle].get("correct_patches", [])
        
        additional_data = {
            "grid_size": grid_size,
            "target_object": target_object,
            "correct_patches": correct_patches
        }
    # For Dart_Count, include the reference image and options
    elif puzzle_type == "Dart_Count":
        # Get the reference image and option images
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        option_images = ground_truth[selected_puzzle].get("option_images", [])
        correct_option_index = ground_truth[selected_puzzle].get("correct_option_index", 0)
        reference_number = ground_truth[selected_puzzle].get("reference_number", 0)
        
        if not reference_image or not option_images:
            return jsonify({'error': f'Invalid dart count data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        option_paths = [f'/captcha_data/{puzzle_type}/{img}' for img in option_images]
        
        additional_data = {
            "reference_image": ref_path,
            "option_images": option_paths,
            "current_option_index": 0,
            "correct_option_index": correct_option_index,
            "reference_number": reference_number
        }
    # For Object_Match, include the reference image and options
    elif puzzle_type == "Object_Match":
        # Get the reference image and option images
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        option_images = ground_truth[selected_puzzle].get("option_images", [])
        correct_option_index = ground_truth[selected_puzzle].get("correct_option_index", 0)
        
        if not reference_image or not option_images:
            return jsonify({'error': f'Invalid object match data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        option_paths = [f'/captcha_data/{puzzle_type}/{img}' for img in option_images]
        
        additional_data = {
            "reference_image": ref_path,
            "option_images": option_paths,
            "current_option_index": 0,
            "correct_option_index": correct_option_index
        }
    # For Select_Animal, include the grid size and target object
    elif puzzle_type == "Select_Animal":
        # Get grid size from ground truth, default to 2x3 grid
        grid_size = ground_truth[selected_puzzle].get("grid_size", [2, 3])
        target_object = ground_truth[selected_puzzle].get("target_object", "fox")
        correct_patches = ground_truth[selected_puzzle].get("correct_patches", [])
        
        additional_data = {
            "grid_size": grid_size,
            "target_object": target_object,
            "correct_patches": correct_patches
        }
    # For Coordinates, include the reference image and options
    elif puzzle_type == "Coordinates":
        # Get the reference image and option images
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        option_images = ground_truth[selected_puzzle].get("option_images", [])
        correct_option_index = ground_truth[selected_puzzle].get("correct_option_index", 0)
        
        if not reference_image or not option_images:
            return jsonify({'error': f'Invalid coordinates data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        option_paths = [f'/captcha_data/{puzzle_type}/{img}' for img in option_images]
        
        additional_data = {
            "reference_image": ref_path,
            "option_images": option_paths,
            "current_option_index": 0,
            "correct_option_index": correct_option_index
        }
    # For Path_Finder, include the reference image and options
    elif puzzle_type == "Path_Finder":
        # Get the reference image and option images
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        options = ground_truth[selected_puzzle].get("options", [])
        correct_option = ground_truth[selected_puzzle].get("correct_option", 0)
        
        if not reference_image or not options:
            return jsonify({'error': f'Invalid path finder data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        option_paths = [f'/captcha_data/{puzzle_type}/{img}' for img in options]
        
        additional_data = {
            "reference_image": ref_path,
            "option_images": option_paths,
            "current_option_index": 0,
            "correct_option_index": correct_option
        }
    # For Connect_icon, include the reference image and options
    elif puzzle_type == "Connect_icon":
        # Get the reference image and option images
        reference_image = ground_truth[selected_puzzle].get("reference_image")
        options = ground_truth[selected_puzzle].get("options", [])
        correct_option = ground_truth[selected_puzzle].get("correct_option", 0)
        
        if not reference_image or not options:
            return jsonify({'error': f'Invalid connect icons data: {selected_puzzle}'}), 500
        
        # Format paths for these images
        ref_path = f'/captcha_data/{puzzle_type}/{reference_image}'
        option_paths = [f'/captcha_data/{puzzle_type}/{img}' for img in options]
        
        additional_data = {
            "reference_image": ref_path,
            "option_images": option_paths,
            "current_option_index": 0,
            "correct_option_index": correct_option
        }
    # For Click_Order, include the order image path
    elif puzzle_type == "Click_Order":
        # Get the order image from ground truth
        order_image = ground_truth[selected_puzzle].get("order_image")
        
        if not order_image:
            return jsonify({'error': f'Invalid click order data: {selected_puzzle}'}), 500
        
        # Format path for the order image
        order_path = f'/captcha_data/{puzzle_type}/{order_image}'
        
        additional_data = {
            "order_image": order_path,
            "tolerance": ground_truth[selected_puzzle].get("tolerance", 20)
        }
    # For Hold_Button, include the hold time
    elif puzzle_type == "Hold_Button":
        # Get the required hold time from ground truth
        hold_time = ground_truth[selected_puzzle].get("hold_time", 3)  # Default to 3 seconds if not specified
        
        additional_data = {
            "hold_time": hold_time
        }
    # For Misleading_Click, include the area to avoid
    elif puzzle_type == "Misleading_Click":
        # Get the area to avoid from ground truth
        avoid_area = ground_truth[selected_puzzle].get("avoid_area", {"x": 0, "y": 0, "width": 0, "height": 0})
        
        additional_data = {
            "avoid_area": avoid_area
        }
    else:
        prompt = ground_truth[selected_puzzle].get("prompt", "Solve the CAPTCHA puzzle")
    
    response_data = {
        'puzzle_type': puzzle_type,
        'image_path': f'/captcha_data/{puzzle_type}/{selected_puzzle}' if puzzle_type != "Rotation_Match" else None,
        'puzzle_id': selected_puzzle,
        'prompt': prompt,
        'input_type': input_type,
        'debug_info': f"Type: {puzzle_type}, Input: {input_type}, Puzzle: {selected_puzzle}"
    }
    
    # Add any additional data for specific puzzle types
    if additional_data:
        response_data.update(additional_data)
    
    return jsonify(response_data)

@app.route('/api/get_ground_truth', methods=['POST'])
def get_ground_truth():
    """Return ground truth data for debugging purposes"""
    data = request.json
    puzzle_type = data.get('puzzle_type')
    puzzle_id = data.get('puzzle_id')
    
    if not puzzle_type or not puzzle_id:
        return jsonify({'error': 'Missing puzzle_type or puzzle_id'}), 400
    
    ground_truth = load_ground_truth(puzzle_type)
    
    if puzzle_id not in ground_truth:
        return jsonify({'error': 'Invalid puzzle ID'}), 400
    
    # Return the ground truth for the specified puzzle
    puzzle_data = ground_truth[puzzle_id]
    
    # For Place_Dot puzzles, include the target_position and tolerance in the answer
    if puzzle_type == 'Place_Dot':
        return jsonify({
            'answer': {
                'target_position': puzzle_data.get('target_position'),
                'tolerance': puzzle_data.get('tolerance', 15)
            },
            'question': puzzle_data.get('question'),
            'description': puzzle_data.get('description')
        })
    # For Misleading_Click puzzles, ensure avoid_area is included in the answer
    elif puzzle_type == 'Misleading_Click':
        return jsonify({
            'answer': {
                'avoid_area': puzzle_data.get('avoid_area', {"x": 0, "y": 0, "width": 0, "height": 0})
            },
            'prompt': puzzle_data.get('prompt'),
            'description': puzzle_data.get('description')
        })
    
    return jsonify({
        'answer': puzzle_data.get('answer'),
        'question': puzzle_data.get('question'),
        'description': puzzle_data.get('description')
    })

@app.route('/api/check_answer', methods=['POST'])
def check_answer():
    data = request.json
    puzzle_type = data.get('puzzle_type', 'Dice_Count')
    puzzle_id = data.get('puzzle_id')
    user_answer = data.get('answer')
    elapsed_time = float(data.get('elapsed_time', 0))

    
    # Validate input
    if not puzzle_id or user_answer is None:
        return jsonify({'error': 'Missing puzzle_id or answer'}), 400
    
    ground_truth = load_ground_truth(puzzle_type)
    
    if puzzle_id not in ground_truth:
        return jsonify({'error': 'Invalid puzzle ID'}), 400
    
    # Get correct answer based on puzzle type
    is_correct = False
    
    if puzzle_type == 'Dice_Count':
        # For dice count, ensure we're comparing numbers
        try:
            correct_answer = ground_truth[puzzle_id].get('sum')
            is_correct = int(user_answer) == int(correct_answer)
        except ValueError:
            return jsonify({'error': 'Invalid answer format'}), 400
            
    elif puzzle_type == 'Geometry_Click':
        # For geometry click, check if click is within the correct area
        try:
            # Get the area boundaries from ground truth
            correct_answer = ground_truth[puzzle_id].get('answer')
            
            # Extract coordinates
            user_x, user_y = user_answer
            
            # Check if the new format is used (with area)
            if isinstance(correct_answer, dict) and 'area' in correct_answer:
                # Get area coordinates (top-left and bottom-right corners)
                top_left, bottom_right = correct_answer['area']
                min_x, min_y = top_left
                max_x, max_y = bottom_right
                
                # Check if click is within the defined area
                is_correct = (min_x <= user_x <= max_x) and (min_y <= user_y <= max_y)
                
                # Return the shape type as part of the correct answer
                shape_type = correct_answer.get('type', 'shape')
                correct_answer_info = {
                    'type': shape_type,
                    'area': correct_answer['area']
                }
            else:
                # Fall back to the old format with distance calculation
                correct_x, correct_y = correct_answer
                
                # Calculate distance and check if within tolerance (25 pixels)
                tolerance = 25
                distance = ((user_x - correct_x) ** 2 + (user_y - correct_y) ** 2) ** 0.5
                is_correct = distance <= tolerance
                correct_answer_info = correct_answer
        except (ValueError, TypeError, KeyError):
            return jsonify({'error': 'Invalid answer format for Geometry_Click'}), 400
    
    elif puzzle_type == 'Rotation_Match':
        # For rotation match, check if the angle matches the correct answer
        try:
            # Get the correct angle from ground truth
            correct_angle = ground_truth[puzzle_id].get('correct_angle')
            
            # User answer should be the current rotation angle
            user_angle = int(user_answer)
            
            # Check if angles match (using modulo to handle full rotations)
            is_correct = user_angle % 360 == correct_angle % 360
            correct_answer_info = correct_angle
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Rotation_Match'}), 400
    
    elif puzzle_type == 'Slide_Puzzle':
        # For slide puzzle, check if the component is positioned correctly
        try:
            # Get the target position from ground truth
            target_position = ground_truth[puzzle_id].get('target_position')
            tolerance = ground_truth[puzzle_id].get('tolerance', 10)
            
            # User answer should be the final position coordinates [x, y]
            user_x, user_y = user_answer
            target_x, target_y = target_position
            
            # Calculate distance from target position
            distance = ((user_x - target_x) ** 2 + (user_y - target_y) ** 2) ** 0.5
            
            # Check if within tolerance
            is_correct = distance <= tolerance
            correct_answer_info = target_position
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Slide_Puzzle'}), 400
    
    elif puzzle_type == 'Unusual_Detection':
        # For unusual detection, check if the selected grid cells match the unusual ones
        try:
            # Get the expected unusual cells from ground truth
            correct_cells = ground_truth[puzzle_id].get('answer', [])
            
            # User answer should be a list of selected grid cell indices
            user_cells = user_answer
            
            # Check if the selected cells match exactly
            is_correct = set(user_cells) == set(correct_cells)
            correct_answer_info = correct_cells
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Unusual_Detection'}), 400
    
    elif puzzle_type == 'Image_Recognition':
        # For image recognition, check if the selected images match the expected ones
        try:
            # Get the expected correct image indices from ground truth
            correct_selections = ground_truth[puzzle_id].get('correct_selections', [])
            
            # User answer should be a list of selected image indices
            user_selections = user_answer
            
            # Check if the selected images match exactly
            is_correct = set(user_selections) == set(correct_selections)
            correct_answer_info = correct_selections
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Image_Recognition'}), 400
    
    elif puzzle_type == 'Bingo':
        # For Bingo, check if the swapped positions would create a line of matching images
        try:
            # Get the expected correct swap options from ground truth
            correct_swaps = ground_truth[puzzle_id].get('answer', [])
            
            # User answer should be a list of two indices to swap
            user_swaps = user_answer
            
            # Check if the swaps match any of the possible correct swaps
            # For this puzzle, there can be multiple correct solutions
            is_correct = False
            
            # Go through each possible solution
            for correct_swap in correct_swaps:
                # Check if user's swap matches this solution (order doesn't matter)
                if (set(user_swaps) == set(correct_swap) or 
                    (set(user_swaps) == set(correct_swap[::-1]) if len(correct_swap) == 2 else False)):
                    is_correct = True
                    break
                    
            correct_answer_info = correct_swaps
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Bingo'}), 400
    
    elif puzzle_type == 'Image_Matching':
        # For Image Matching, check if the selected option index matches the correct one
        try:
            # Get the correct option index from ground truth
            correct_index = ground_truth[puzzle_id].get('correct_option_index')
            
            # User answer should be the selected option index
            user_index = int(user_answer)
            
            # Check if indices match
            is_correct = user_index == correct_index
            correct_answer_info = correct_index
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Image_Matching'}), 400
    
    elif puzzle_type == 'Patch_Select':
        # For Patch_Select, check if the selected patches match the correct ones
        try:
            # Get the correct patches from ground truth
            correct_patches = ground_truth[puzzle_id].get('correct_patches', [])
            
            # User answer should be a list of selected patch indices
            user_patches = user_answer
            
            # Check if the selected patches match exactly
            is_correct = set(user_patches) == set(correct_patches)
            correct_answer_info = correct_patches
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Patch_Select'}), 400
    
    elif puzzle_type == 'Dart_Count':
        # For Dart_Count, check if the selected option index matches the correct one
        try:
            # Get the correct option index from ground truth
            correct_index = ground_truth[puzzle_id].get('correct_option_index')
            
            # User answer should be the selected option index
            user_index = int(user_answer)
            
            # Check if indices match
            is_correct = user_index == correct_index
            correct_answer_info = correct_index
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Dart_Count'}), 400
    
    elif puzzle_type == 'Place_Dot':
        # For Place_Dot, check if the dot is placed at the end of the car's path
        try:
            # Get the target position from ground truth
            target_position = ground_truth[puzzle_id].get('target_position')
            tolerance = ground_truth[puzzle_id].get('tolerance', 15)  # Default tolerance of 15 pixels
            
            # Extract coordinates from user's answer (click position)
            user_x, user_y = user_answer
            target_x, target_y = target_position
            
            # Calculate distance from target position
            distance = ((user_x - target_x) ** 2 + (user_y - target_y) ** 2) ** 0.5
            
            # Check if within tolerance
            is_correct = distance <= tolerance
            correct_answer_info = target_position
        except (ValueError, TypeError, KeyError):
            return jsonify({'error': 'Invalid answer format for Place_Dot'}), 400
    
    elif puzzle_type == 'Object_Match':
        # For Object_Match, check if the selected option index matches the correct one
        try:
            # Get the correct option index from ground truth
            correct_index = ground_truth[puzzle_id].get('correct_option_index')
            
            # User answer should be the selected option index
            user_index = int(user_answer)
            
            # Check if indices match
            is_correct = user_index == correct_index
            correct_answer_info = correct_index
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Object_Match'}), 400
    
    elif puzzle_type == 'Select_Animal':
        # For Select_Animal, check if the selected patches match the correct ones
        try:
            # Get the correct patches from ground truth
            correct_patches = ground_truth[puzzle_id].get('correct_patches', [])
            
            # User answer should be a list of selected patch indices
            user_patches = user_answer
            
            # Check if the selected patches match exactly
            is_correct = set(user_patches) == set(correct_patches)
            correct_answer_info = correct_patches
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Select_Animal'}), 400
    
    elif puzzle_type == 'Coordinates':
        # For Coordinates, check if the selected option index matches the correct one
        try:
            # Get the correct option index from ground truth
            correct_index = ground_truth[puzzle_id].get('correct_option_index')
            
            # User answer should be the selected option index
            user_index = int(user_answer)
            
            # Check if indices match
            is_correct = user_index == correct_index
            correct_answer_info = correct_index
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Coordinates'}), 400
    
    elif puzzle_type == 'Path_Finder':
        # For Path_Finder, check if the selected option index matches the correct one
        try:
            # Get the correct option index from ground truth
            correct_index = ground_truth[puzzle_id].get('correct_option')
            
            # User answer should be the selected option index
            user_index = int(user_answer)
            
            # Check if indices match
            is_correct = user_index == correct_index
            correct_answer_info = correct_index
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Path_Finder'}), 400
    
    elif puzzle_type == 'Connect_icon':
        # For Connect_icon, check if the selected option index matches the correct one
        try:
            # Get the correct option index from ground truth
            correct_index = ground_truth[puzzle_id].get('correct_option')
            
            # User answer should be the selected option index
            user_index = int(user_answer)
            
            # Check if indices match
            is_correct = user_index == correct_index
            correct_answer_info = correct_index
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Connect_icon'}), 400
    
    elif puzzle_type == 'Click_Order':
        # For Click_Order, check if the clicked positions match the expected order
        try:
            # Get the correct coordinates and tolerance from ground truth
            correct_positions = ground_truth[puzzle_id].get('answer', [])
            tolerance = ground_truth[puzzle_id].get('tolerance', 20)  # Default tolerance of 20 pixels
            
            # User answer should be a list of clicked positions in order
            user_positions = user_answer
            
            # Check if the number of clicks matches
            if len(user_positions) != len(correct_positions):
                is_correct = False
            else:
                # Check each position with tolerance
                is_correct = True
                for i, (user_pos, correct_pos) in enumerate(zip(user_positions, correct_positions)):
                    user_x, user_y = user_pos
                    correct_x, correct_y = correct_pos
                    
                    # Calculate distance
                    distance = ((user_x - correct_x) ** 2 + (user_y - correct_y) ** 2) ** 0.5
                    
                    # If any position is outside tolerance, the answer is incorrect
                    if distance > tolerance:
                        is_correct = False
                        break
            
            correct_answer_info = correct_positions
        except (ValueError, TypeError, KeyError):
            return jsonify({'error': 'Invalid answer format for Click_Order'}), 400
    
    elif puzzle_type == 'Hold_Button':
        # For Hold_Button, check if the hold time is within the allowed range
        try:
            # Get the required hold time from ground truth
            hold_time = ground_truth[puzzle_id].get("hold_time", 3)  # Default to 3 seconds if not specified
            
            # User answer should be a number representing the hold time in seconds
            user_hold_time = float(user_answer)
            
            if elapsed_time > 8 and user_hold_time < hold_time:
                is_correct = False
                correct_answer_info = f"Timeout ({elapsed_time:.2f}s)"
            else:
                is_correct = hold_time >= user_hold_time >= 0
                correct_answer_info = hold_time

        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid answer format for Hold_Button'}), 400
    
    elif puzzle_type == 'Misleading_Click':
        # For Misleading_Click, check if the click is NOT within the area to avoid
        try:
            # Get the area to avoid from ground truth
            avoid_area = ground_truth[puzzle_id].get("avoid_area", {"x": 0, "y": 0, "width": 0, "height": 0})
            
            # Extract coordinates from user's answer (click position)
            user_x, user_y = user_answer
            
            # Check if click is outside the area to avoid
            area_x = avoid_area["x"]
            area_y = avoid_area["y"]
            area_width = avoid_area["width"]
            area_height = avoid_area["height"]
            
            # Click should be outside the avoid area to be correct
            is_inside_avoid_area = (
                area_x <= user_x <= area_x + area_width and 
                area_y <= user_y <= area_y + area_height
            )
            
            # User is correct if they clicked outside the avoid area
            is_correct = not is_inside_avoid_area
            correct_answer_info = "Click outside the red bear area"
        except (ValueError, TypeError, KeyError):
            return jsonify({'error': 'Invalid answer format for Misleading_Click'}), 400
    
    elif puzzle_type == 'Pick_Area':
        # For Pick_Area, check if click is within the correct area
        try:
            # Get the area boundaries from ground truth
            correct_answer = ground_truth[puzzle_id].get('answer')
            
            # Extract coordinates
            user_x, user_y = user_answer
            
            # Check if the correct area is defined
            if isinstance(correct_answer, dict) and 'area' in correct_answer:
                # Get area coordinates (top-left and bottom-right corners)
                top_left, bottom_right = correct_answer['area']
                min_x, min_y = top_left
                max_x, max_y = bottom_right
                
                # Check if click is within the defined area
                is_correct = (min_x <= user_x <= max_x) and (min_y <= user_y <= max_y)
                
                # Return the area type as part of the correct answer
                area_type = correct_answer.get('type', 'largest region')
                correct_answer_info = {
                    'type': area_type,
                    'area': correct_answer['area']
                }
            else:
                # Fall back if area is not properly defined
                is_correct = False
                correct_answer_info = correct_answer
        except (ValueError, TypeError, KeyError):
            return jsonify({'error': 'Invalid answer format for Pick_Area'}), 400
    
    else:
        # For other types, compare as strings (case insensitive)
        correct_answer = ground_truth[puzzle_id].get('answer')
        is_correct = str(user_answer).lower() == str(correct_answer).lower()
        correct_answer_info = correct_answer
    
    # Get the appropriate answer field based on puzzle type
    if puzzle_type == 'Dice_Count':
        answer_key = 'sum'
    elif puzzle_type == 'Patch_Select':
        answer_key = 'correct_patches'
    elif puzzle_type == 'Select_Animal':
        answer_key = 'correct_patches'
    elif puzzle_type == 'Coordinates':
        answer_key = 'correct_option_index'
    elif puzzle_type == 'Path_Finder':
        answer_key = 'correct_option'
    elif puzzle_type == 'Connect_icon':
        answer_key = 'correct_option'
    elif puzzle_type == 'Click_Order':
        answer_key = 'answer'
    elif puzzle_type == 'Hold_Button':
        answer_key = 'hold_time'
    elif puzzle_type == 'Misleading_Click':
        answer_key = 'answer'
    elif puzzle_type == 'Pick_Area':
        answer_key = 'answer'
    else:
        answer_key = 'answer'
    
    return jsonify({
        'correct': is_correct,
        'user_answer': user_answer,
        'correct_answer': ground_truth[puzzle_id].get(answer_key)
    })

@app.route('/api/benchmark_results', methods=['POST'])
def record_benchmark():
    data = request.json
    
    # Add timestamp if not provided
    if 'timestamp' not in data:
        from datetime import datetime
        data['timestamp'] = datetime.now().isoformat()
    
    # In a real system, you would save this data to a database
    # For this example, we'll just print it to the console
    print(f"Benchmark results: {data}")
    
    # You could store this in a log file as well
    with open('benchmark_results.json', 'a') as f:
        f.write(json.dumps(data) + '\n')
    
    return jsonify({'status': 'success'})

@app.route('/api/types', methods=['GET'])
def get_types():
    """Get available CAPTCHA types"""
    return jsonify({
        'types': get_captcha_types()
    })

if __name__ == '__main__':
    # For local development
    if os.environ.get('DEVELOPMENT'):
        app.run(debug=True)
    else:
        # For production on Hugging Face Spaces
        app.run(host='0.0.0.0', port=7860) 