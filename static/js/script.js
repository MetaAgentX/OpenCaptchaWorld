let puzzleStartTime = null;

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const submitBtn = document.getElementById('submit-answer');
    const userAnswerInput = document.getElementById('user-answer');
    const puzzleImage = document.getElementById('puzzle-image');
    const puzzleImageContainer = document.querySelector('.puzzle-image-container');
    const resultMessage = document.getElementById('result-message');
    const totalCount = document.getElementById('total-count');
    const correctCount = document.getElementById('correct-count');
    const accuracyEl = document.getElementById('accuracy');
    const puzzlePrompt = document.getElementById('puzzle-prompt');
    const puzzleContainer = document.getElementById('puzzle-container');
    const inputGroup = document.querySelector('.input-group');
    const difficultyStars = document.getElementById('difficulty-stars');

    // Debug mode - set to true to show ground truth areas
    const DEBUG_MODE = false;

    // Tracking state
    let currentPuzzle = null;
    let benchmarkStats = {
        total: 0,
        correct: 0
    };
    let clickCoordinates = null;
    let processingClick = false; // Flag to prevent multiple clicks while processing
    let currentRotationAngle = 0; // Track current rotation for Rotation_Match
    let selectedCells = []; // Track selected cells for Unusual_Detection
    let bingoSelectedCells = []; // Track selected cells for Bingo swap
    let selectedAnimalIndex = -1; // Track selected animal index for Select_Animal
    // Add debug type tracking variable 
    // let debugPuzzleType = null;
    
    // Initialize difficulty stars with default value (to show something immediately)
    displayDifficultyStars('Dice_Count');
    
    // Event listeners
    submitBtn.addEventListener('click', submitAnswer);
    userAnswerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitAnswer();
        }
    });

    // Add click event handler directly to the puzzle image
    puzzleImage.addEventListener('click', handleImageClick);

    // Add debug mode selector
    // setupDebugModeSelector();

    // Functions
    function handleImageClick(e) {
        if (currentPuzzle && currentPuzzle.input_type === 'click' && !processingClick) {
            // Prevent multiple clicks while processing
            processingClick = true;
            
            // Get click coordinates relative to the image
            const rect = e.target.getBoundingClientRect();
            const x = Math.round(e.clientX - rect.left);
            const y = Math.round(e.clientY - rect.top);
            
            // Store coordinates for submission
            clickCoordinates = [x, y];
            
            // Show where user clicked
            showClickMarker(x, y);
            
            // Log for debugging
            console.log('Click received:', { x, y, target: e.target.id });
            
            // Special handling for Misleading_Click to show if click is in avoid area
            if (currentPuzzle.puzzle_type === 'Misleading_Click' && currentPuzzle.avoid_area) {
                const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = currentPuzzle.avoid_area;
                
                // Check if click is within the avoid area
                const inAvoidArea = (
                    areaX <= x && x <= areaX + areaWidth &&
                    areaY <= y && y <= areaY + areaHeight
                );
                
                if (inAvoidArea) {
                    console.log('Click is inside the avoid area! This is incorrect.');
                    
                    // Add a visual indicator
                    const marker = document.querySelector('.click-marker');
                    if (marker) {
                        marker.style.borderColor = 'red';
                        marker.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                    }
                } else {
                    console.log('Click is outside the avoid area! This is correct.');
                    
                    // Add a visual indicator
                    const marker = document.querySelector('.click-marker');
                    if (marker) {
                        marker.style.borderColor = 'green';
                        marker.style.backgroundColor = 'rgba(0, 255, 0, 0.7)';
                    }
                }
            }
            // Special handling for Pick_Area to show if click is in the target area
            else if (currentPuzzle.puzzle_type === 'Pick_Area') {
                // Get the ground truth data to validate the click
                fetch('/api/get_ground_truth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        puzzle_type: currentPuzzle.puzzle_type,
                        puzzle_id: currentPuzzle.puzzle_id
                    })
                })
                .then(response => response.json())
                .then(gtData => {
                    if (gtData.answer && gtData.answer.area) {
                        // Extract area boundaries from the ground truth
                        const [[minX, minY], [maxX, maxY]] = gtData.answer.area;
                        
                        // Basic rectangular check
                        const inRectArea = (minX <= x && x <= maxX && minY <= y && y <= maxY);
                        
                        // For more accurate curve detection:
                        let inPolygonArea = false;
                        if (gtData.answer.polygon) {
                            // If we have a polygon definition for the curved area
                            inPolygonArea = pointInPolygon(x, y, gtData.answer.polygon);
                        }
                        
                        // Determine if the click is in the target area
                        // Use polygon if available, otherwise fall back to rectangular check
                        const inArea = gtData.answer.polygon ? inPolygonArea : inRectArea;
                        
                        // Get the marker element
                        const marker = document.querySelector('.click-marker');
                        if (marker) {
                            if (inArea) {
                                console.log('Click is inside the target area! This is correct.');
                                marker.style.borderColor = 'green';
                                marker.style.backgroundColor = 'rgba(0, 255, 0, 0.7)';
                                
                                // Add a success message
                                const successMsg = document.createElement('div');
                                successMsg.className = 'success-msg';
                                successMsg.textContent = 'In largest area!';
                                successMsg.style.position = 'absolute';
                                successMsg.style.top = '-25px';
                                successMsg.style.left = '50%';
                                successMsg.style.transform = 'translateX(-50%)';
                                successMsg.style.backgroundColor = 'rgba(0, 128, 0, 0.9)';
                                successMsg.style.color = 'white';
                                successMsg.style.padding = '3px 8px';
                                successMsg.style.borderRadius = '3px';
                                successMsg.style.fontSize = '12px';
                                successMsg.style.fontWeight = 'bold';
                                marker.appendChild(successMsg);
                            } else {
                                console.log('Click is outside the target area! This is incorrect.');
                                marker.style.borderColor = 'red';
                                marker.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                                
                                // Add an error message
                                const errorMsg = document.createElement('div');
                                errorMsg.className = 'error-msg';
                                errorMsg.textContent = 'Not in largest area!';
                                errorMsg.style.position = 'absolute';
                                errorMsg.style.top = '-25px';
                                errorMsg.style.left = '50%';
                                errorMsg.style.transform = 'translateX(-50%)';
                                errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
                                errorMsg.style.color = 'white';
                                errorMsg.style.padding = '3px 8px';
                                errorMsg.style.borderRadius = '3px';
                                errorMsg.style.fontSize = '12px';
                                errorMsg.style.fontWeight = 'bold';
                                marker.appendChild(errorMsg);
                            }
                        }
                    }
                })
                .catch(error => {
                    console.error('Error validating click for Pick_Area:', error);
                });
            }
            
            // Auto-submit after click
            setTimeout(() => {
                submitAnswer();
            }, 500); // Increase delay slightly to allow for fetch response
        }
    }

    // Function to handle rotation
    function setupRotationControls() {
        // Remove any existing controls first
        const existingControls = document.querySelector('.rotation-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        // Create rotation controls
        const rotationControls = document.createElement('div');
        rotationControls.className = 'rotation-controls';
        
        // Create left rotation button
        const leftBtn = document.createElement('button');
        leftBtn.className = 'rotate-left';
        leftBtn.innerHTML = '&#8630;'; // Counter-clockwise arrow
        leftBtn.setAttribute('aria-label', 'Rotate left');
        
        // Create right rotation button
        const rightBtn = document.createElement('button');
        rightBtn.className = 'rotate-right';
        rightBtn.innerHTML = '&#8631;'; // Clockwise arrow
        rightBtn.setAttribute('aria-label', 'Rotate right');
        
        // Add buttons to controls
        rotationControls.appendChild(leftBtn);
        rotationControls.appendChild(rightBtn);
        
        // Add to puzzle container
        const imageWrapper = document.querySelector('.puzzle-image-wrapper');
        
        // Create a container for the reference image
        const referenceContainer = document.createElement('div');
        referenceContainer.className = 'reference-image-container';
        const referenceImg = document.createElement('img');
        referenceImg.id = 'reference-image';
        referenceImg.src = currentPuzzle.reference_image;
        referenceImg.alt = 'Reference direction';
        referenceContainer.appendChild(referenceImg);
        
        // Create a container for the object image
        const objectContainer = document.createElement('div');
        objectContainer.className = 'object-image-container';
        const objectImg = document.createElement('img');
        objectImg.id = 'object-image';
        objectImg.src = currentPuzzle.object_image;
        objectImg.alt = 'Rotatable object';
        objectContainer.appendChild(objectImg);
        
        // Create a two-column layout for rotation puzzle
        const rotationLayout = document.createElement('div');
        rotationLayout.className = 'rotation-layout';
        rotationLayout.appendChild(referenceContainer);
        rotationLayout.appendChild(objectContainer);
        
        // Replace the existing puzzle image
        puzzleImageContainer.innerHTML = '';
        puzzleImageContainer.appendChild(rotationLayout);
        
        // Add rotation controls below the image
        imageWrapper.appendChild(rotationControls);
        
        // Add event listeners for rotation buttons
        leftBtn.addEventListener('click', () => rotateObject(-45));
        rightBtn.addEventListener('click', () => rotateObject(45));
        
        // Set initial angle
        currentRotationAngle = currentPuzzle.current_angle || 0;
        updateObjectRotation();
    }
    
    function rotateObject(angleDelta) {
        // Update the current angle
        currentRotationAngle = (currentRotationAngle + angleDelta) % 360;
        if (currentRotationAngle < 0) {
            currentRotationAngle += 360;
        }
        
        // Apply the rotation
        updateObjectRotation();
        
        // Log for debugging
        console.log('Rotated to:', currentRotationAngle);
    }
    
    function updateObjectRotation() {
        const objectImg = document.getElementById('object-image');
        if (objectImg) {
            // Option 1: Use CSS transform to rotate the image
            objectImg.style.transform = `rotate(${currentRotationAngle}deg)`;
            
            // Option 2: Load a pre-rotated image if available
            // This would require having images at each rotation angle
            const baseName = currentPuzzle.object_base;
            // Find the closest pre-rotated image (0, 90, 180, 270)
            const angles = [0, 45, 90, 135, 180, 225, 270, 315];
            const closestAngle = angles.reduce((prev, curr) => 
                Math.abs(curr - currentRotationAngle) < Math.abs(prev - currentRotationAngle) ? curr : prev
            );
            
            // Load the pre-rotated image
            const rotatedImagePath = `/captcha_data/${currentPuzzle.puzzle_type}/${baseName}_${closestAngle}.png`;
            objectImg.src = rotatedImagePath;
            
            // Apply any additional rotation needed
            const remainingRotation = currentRotationAngle - closestAngle;
            if (remainingRotation !== 0) {
                objectImg.style.transform = `rotate(${remainingRotation}deg)`;
            } else {
                objectImg.style.transform = 'none';
            }
        }
    }

    // Function to set up sliding puzzle
    function setupSlidePuzzle() {
        // Remove any existing controls first
        const existingSlider = document.querySelector('.slider-component');
        if (existingSlider) {
            existingSlider.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Create a container for the background image
        const backgroundContainer = document.createElement('div');
        backgroundContainer.className = 'background-container';
        backgroundContainer.style.position = 'relative';
        backgroundContainer.style.width = '100%';
        backgroundContainer.style.height = 'auto';
        
        // Add background image
        const backgroundImg = document.createElement('img');
        backgroundImg.src = currentPuzzle.background_image;
        backgroundImg.alt = 'Slide puzzle background';
        backgroundImg.style.width = '100%';
        backgroundImg.style.height = 'auto';
        backgroundImg.style.display = 'block';
        backgroundContainer.appendChild(backgroundImg);
        
        // Create draggable slider component
        const sliderComponent = document.createElement('div');
        sliderComponent.className = 'slider-component';
        sliderComponent.style.position = 'absolute';
        sliderComponent.style.cursor = 'move';
        sliderComponent.style.zIndex = '10';
        sliderComponent.style.userSelect = 'none';
        sliderComponent.style.touchAction = 'none';
        sliderComponent.style.width = '50px'; 
        
        // Add component image
        const componentImg = document.createElement('img');
        componentImg.src = currentPuzzle.component_image;
        componentImg.alt = 'Slide component';
        componentImg.style.width = '150%';
        componentImg.style.height = 'auto';
        componentImg.style.display = 'block';
        componentImg.draggable = false; // Prevent default dragging behavior
        sliderComponent.appendChild(componentImg);
        
        // Add slider component to the background container
        backgroundContainer.appendChild(sliderComponent);
        
        // Add the whole setup to the puzzle image container
        puzzleImageContainer.appendChild(backgroundContainer);
        
        // Wait for images to load to get proper dimensions
        backgroundImg.onload = () => {
            // Get container dimensions
            const containerWidth = backgroundImg.width;
            const containerHeight = backgroundImg.height;
            
            // Load component image to get its dimensions
            componentImg.onload = () => {
                const originalComponentWidth = componentImg.naturalWidth;
                const originalComponentHeight = componentImg.naturalHeight;
                
                const componentWidth = containerWidth * 0.08;
                
                const aspectRatio = originalComponentWidth / originalComponentHeight;
                const componentHeight = componentWidth / aspectRatio;
                
                sliderComponent.style.width = `${componentWidth}px`;
                
                // Initial position for the slider component - bottom right corner (far from typical target)
                const initialLeft = containerWidth - componentWidth - 20;
                const initialTop = containerHeight - componentHeight - 20;
                
                sliderComponent.style.left = `${initialLeft}px`;
                sliderComponent.style.top = `${initialTop}px`;
                
                // Initialize current position tracking variables
                currentX = initialLeft;
                currentY = initialTop;
                
                // In debug mode, fetch and show the target area
                if (DEBUG_MODE) {
                    fetch('/api/get_ground_truth', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            puzzle_type: currentPuzzle.puzzle_type,
                            puzzle_id: currentPuzzle.puzzle_id
                        })
                    })
                    .then(response => response.json())
                    .then(gtData => {
                        if (gtData.answer) {
                            // Get tolerance value if available
                            const tolerance = gtData.answer.tolerance || 15; // Default to 15px
                            showSliderTargetArea(gtData.answer, backgroundContainer, tolerance);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching ground truth:', error);
                    });
                }
            };
        };
        
        // Set up draggable functionality
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        // Track current position
        let currentX = 0;
        let currentY = 0;
        
        // Mouse events for desktop
        sliderComponent.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(sliderComponent.style.left) || 0;
            startTop = parseInt(sliderComponent.style.top) || 0;
            sliderComponent.style.opacity = '0.8';
            
            // Prevent default browser behavior
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            // Calculate new position
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Calculate new position
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            // Get container dimensions
            const containerRect = backgroundContainer.getBoundingClientRect();
            const sliderRect = sliderComponent.getBoundingClientRect();
            
            // Ensure the slider stays within the container bounds
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft > containerRect.width - sliderRect.width) 
                newLeft = containerRect.width - sliderRect.width;
            if (newTop > containerRect.height - sliderRect.height) 
                newTop = containerRect.height - sliderRect.height;
            
            sliderComponent.style.left = `${newLeft}px`;
            sliderComponent.style.top = `${newTop}px`;
            
            // Update current position
            currentX = newLeft;
            currentY = newTop;
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                sliderComponent.style.opacity = '1';
                
                // Calculate center point
                const componentRect = componentImg.getBoundingClientRect();
                const centerX = currentX + (componentRect.width / 2);
                const centerY = currentY + (componentRect.height / 2);
                
                // Log final position for debugging
                console.log('Slider final position (top-left):', { x: currentX, y: currentY });
                console.log('Slider center position:', { x: centerX, y: centerY });
            }
        });
        
        // Touch events for mobile
        sliderComponent.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startLeft = parseInt(sliderComponent.style.left) || 0;
            startTop = parseInt(sliderComponent.style.top) || 0;
            sliderComponent.style.opacity = '0.8';
            
            // Prevent default browser behavior
            e.preventDefault();
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            // Calculate new position
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;
            
            // Calculate new position
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            // Get container dimensions
            const containerRect = backgroundContainer.getBoundingClientRect();
            const sliderRect = sliderComponent.getBoundingClientRect();
            
            // Ensure the slider stays within the container bounds
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft > containerRect.width - sliderRect.width) 
                newLeft = containerRect.width - sliderRect.width;
            if (newTop > containerRect.height - sliderRect.height) 
                newTop = containerRect.height - sliderRect.height;
            
            sliderComponent.style.left = `${newLeft}px`;
            sliderComponent.style.top = `${newTop}px`;
            
            // Update current position
            currentX = newLeft;
            currentY = newTop;
        });
        
        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                sliderComponent.style.opacity = '1';
                
                // Calculate center point
                const componentRect = componentImg.getBoundingClientRect();
                const centerX = currentX + (componentRect.width / 2);
                const centerY = currentY + (componentRect.height / 2);
                
                // Log final position for debugging
                console.log('Slider final position (top-left):', { x: currentX, y: currentY });
                console.log('Slider center position:', { x: centerX, y: centerY });
            }
        });
        
        // Add submit button for the sliding puzzle
        const submitSection = document.createElement('div');
        submitSection.className = 'slider-submit';
        const sliderSubmitBtn = document.createElement('button');
        sliderSubmitBtn.textContent = 'Submit';
        sliderSubmitBtn.className = 'submit-slider';
        
        sliderSubmitBtn.addEventListener('click', () => {
            // When submitting, we need to get the final position
            // and normalize it to the image dimensions
            const componentRect = componentImg.getBoundingClientRect();
            
            // Calculate center point of the component
            const centerX = currentX + (componentRect.width / 2);
            const centerY = currentY + (componentRect.height / 2);
            
            // Submit this position
            console.log('Submitting slider position:', { x: centerX, y: centerY });
            submitSliderPosition(centerX, centerY);
        });
        
        submitSection.appendChild(sliderSubmitBtn);
        
        // Add to puzzle container
        const imageWrapper = document.querySelector('.puzzle-image-wrapper');
        imageWrapper.appendChild(submitSection);
    }
    
    // Function to show the target area for the slider in debug mode
    function showSliderTargetArea(targetPosition, container, tolerance = 15) {
        if (!DEBUG_MODE || !targetPosition) return;
        
        // Remove any existing debug targets
        const existingTarget = document.querySelector('.target-area');
        if (existingTarget) {
            existingTarget.remove();
        }
        
        // Create a target element
        const targetArea = document.createElement('div');
        targetArea.className = 'target-area';
        
        // Get target coordinates
        const [targetX, targetY] = targetPosition;
        
        // We'll visualize this as a circle
        const diameter = tolerance * 2;
        
        // Style the target area
        targetArea.style.position = 'absolute';
        targetArea.style.left = `${targetX - tolerance}px`;
        targetArea.style.top = `${targetY - tolerance}px`;
        targetArea.style.width = `${diameter}px`;
        targetArea.style.height = `${diameter}px`;
        targetArea.style.borderRadius = '50%';
        targetArea.style.border = '2px dashed green';
        targetArea.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        targetArea.style.zIndex = '5';
        targetArea.style.pointerEvents = 'none'; // Allow clicks to pass through
        
        // Add coordinates label
        const coordsLabel = document.createElement('div');
        coordsLabel.className = 'coords-label';
        coordsLabel.textContent = `Target: (${targetX}, ${targetY}) ±${tolerance}px`;
        coordsLabel.style.position = 'absolute';
        coordsLabel.style.top = '-25px';
        coordsLabel.style.left = '0';
        coordsLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        coordsLabel.style.color = 'white';
        coordsLabel.style.padding = '2px 5px';
        coordsLabel.style.fontSize = '10px';
        coordsLabel.style.borderRadius = '3px';
        coordsLabel.style.whiteSpace = 'nowrap';
        targetArea.appendChild(coordsLabel);
        
        // Add to the container
        container.appendChild(targetArea);
        
        // Log the target details
        console.log('Target position:', { 
            x: targetX, 
            y: targetY,
            tolerance: tolerance
        });
    }

    // Function to submit slider position
    function submitSliderPosition(x, y) {
        if (!currentPuzzle) {
            resultMessage.textContent = 'Loading puzzle, please wait...';
            resultMessage.className = 'result-message incorrect';
            return;
        }
        
        // Send position to the server for verification
        fetch('/api/check_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                puzzle_type: currentPuzzle.puzzle_type,
                puzzle_id: currentPuzzle.puzzle_id,
                answer: [x, y]
            })
        })
        .then(response => response.json())
        .then(data => {
            // Update stats
            benchmarkStats.total++;
            if (data.correct) {
                benchmarkStats.correct++;
                resultMessage.textContent = 'Correct! The slider was placed in the right position.';
                resultMessage.className = 'result-message correct';
            } else {
                resultMessage.textContent = 'Incorrect. Please try again with a better position.';
                resultMessage.className = 'result-message incorrect';
            }
            
            updateStats();
            
            // Record benchmark result
            recordBenchmarkResult({
                puzzle_type: currentPuzzle.puzzle_type,
                puzzle_id: currentPuzzle.puzzle_id,
                user_answer: [x, y],
                correct_answer: data.correct_answer,
                correct: data.correct
            });
            
            // Disable the submit button to prevent multiple submissions
            const submitBtn = document.querySelector('.submit-slider');
            if (submitBtn) {
                submitBtn.disabled = true;
            }
            
            // Also disable rotation submit button if it exists
            const rotateSubmitBtn = document.querySelector('.submit-rotation');
            if (rotateSubmitBtn) {
                rotateSubmitBtn.disabled = true;
            }
            
            // Also disable image recognition submit button if it exists
            const imageRecognitionSubmitBtn = document.querySelector('.submit-image-recognition');
            if (imageRecognitionSubmitBtn) {
                imageRecognitionSubmitBtn.disabled = true;
            }
            
            // Also disable bingo submit button if it exists
            const bingoSubmitBtn = document.querySelector('.submit-bingo');
            if (bingoSubmitBtn) {
                bingoSubmitBtn.disabled = true;
            }
            
            // Also disable image matching submit button if it exists
            const imageMatchingSubmitBtn = document.querySelector('.submit-image-matching');
            if (imageMatchingSubmitBtn) {
                imageMatchingSubmitBtn.disabled = true;
            }
            
            // Load a new puzzle after a delay
            setTimeout(loadNewPuzzle, 2000);
        })
        .catch(error => {
            console.error('Error checking answer:', error);
            resultMessage.textContent = 'Error checking answer. Please try again.';
            resultMessage.className = 'result-message incorrect';
        });
    }

    // Add this new function to show the ground truth area
    function showGroundTruthArea(answer) {
        if (!DEBUG_MODE) return;
        
        // Remove any existing debug areas
        const existingArea = document.querySelector('.debug-area');
        if (existingArea) {
            existingArea.remove();
        }
        
        // Create and style the debug area element
        const debugArea = document.createElement('div');
        debugArea.className = 'debug-area';
        debugArea.style.position = 'absolute';
        debugArea.style.pointerEvents = 'none'; // Allow clicks to pass through
        debugArea.style.zIndex = '5';
        
        if (answer && answer.area) {
            // For standard area format (geometry_click, etc.)
            const [[x1, y1], [x2, y2]] = answer.area;
            
            debugArea.style.left = `${x1}px`;
            debugArea.style.top = `${y1}px`;
            debugArea.style.width = `${x2 - x1}px`;
            debugArea.style.height = `${y2 - y1}px`;
            debugArea.style.border = '2px dashed yellow';
            debugArea.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
            
            // Add coordinates label
            const coordsLabel = document.createElement('div');
            coordsLabel.className = 'coords-label';
            coordsLabel.textContent = `TL: (${x1},${y1}) BR: (${x2},${y2})`;
            coordsLabel.style.position = 'absolute';
            coordsLabel.style.bottom = '0';
            coordsLabel.style.right = '0';
            coordsLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            coordsLabel.style.color = 'white';
            coordsLabel.style.padding = '2px 5px';
            coordsLabel.style.fontSize = '10px';
            coordsLabel.style.borderRadius = '3px';
            debugArea.appendChild(coordsLabel);
            
            // Log the area details
            console.log('Ground truth area:', { 
                topLeft: [x1, y1], 
                bottomRight: [x2, y2], 
                width: x2 - x1, 
                height: y2 - y1,
                type: answer.type
            });
        } else if (answer && answer.avoid_area) {
            // For Misleading_Click avoid_area format
            const { x, y, width, height } = answer.avoid_area;
            
            debugArea.style.left = `${x}px`;
            debugArea.style.top = `${y}px`;
            debugArea.style.width = `${width}px`;
            debugArea.style.height = `${height}px`;
            debugArea.style.border = '3px dashed red';
            debugArea.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
            
            // Add coordinates label
            const coordsLabel = document.createElement('div');
            coordsLabel.className = 'coords-label';
            coordsLabel.textContent = `Avoid Area: (${x},${y}) ${width}x${height}`;
            coordsLabel.style.position = 'absolute';
            coordsLabel.style.bottom = '0';
            coordsLabel.style.right = '0';
            coordsLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            coordsLabel.style.color = 'white';
            coordsLabel.style.padding = '2px 5px';
            coordsLabel.style.fontSize = '10px';
            coordsLabel.style.borderRadius = '3px';
            debugArea.appendChild(coordsLabel);
            
            // Add a "DO NOT CLICK HERE" sign in the middle of the area
            const warningSign = document.createElement('div');
            warningSign.className = 'warning-sign';
            warningSign.textContent = 'DO NOT CLICK HERE';
            warningSign.style.position = 'absolute';
            warningSign.style.top = '50%';
            warningSign.style.left = '50%';
            warningSign.style.transform = 'translate(-50%, -50%)';
            warningSign.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            warningSign.style.color = '#ff5555';
            warningSign.style.padding = '5px 10px';
            warningSign.style.fontSize = '12px';
            warningSign.style.fontWeight = 'bold';
            warningSign.style.borderRadius = '3px';
            warningSign.style.whiteSpace = 'nowrap';
            warningSign.style.zIndex = '10';
            debugArea.appendChild(warningSign);
            
            // Log the area details
            console.log('Avoid area:', { x, y, width, height });
        } else {
            // If we don't have a valid format, don't show anything
            return;
        }
        
        // Add to the image container
        puzzleImageContainer.appendChild(debugArea);
    }

    // Function to fetch and show geometry click target area
    function fetchAndShowGeometryClickArea(container) {
        if (!DEBUG_MODE || !currentPuzzle) return;
        
        // Fetch ground truth data to show the correct geometric shape area
        fetch('/api/get_ground_truth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                puzzle_type: currentPuzzle.puzzle_type,
                puzzle_id: currentPuzzle.puzzle_id
            })
        })
        .then(response => response.json())
        .then(gtData => {
            if (gtData.answer) {
                // Call showGroundTruthArea with the answer data
                showGroundTruthArea(gtData.answer);
                
                // Log for debugging
                console.log('Geometry_Click ground truth fetched:', gtData.answer);
            }
        })
        .catch(error => {
            console.error('Error fetching ground truth for Geometry_Click:', error);
        });
    }

    function showClickMarker(x, y) {
        // Remove any existing markers
        const existingMarker = document.querySelector('.click-marker');
        if (existingMarker) {
            existingMarker.remove();
        }
        
        // Create and add new marker
        const marker = document.createElement('div');
        marker.className = 'click-marker';
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;
        
        // Add coordinates label to the marker
        const coordsLabel = document.createElement('div');
        coordsLabel.className = 'coords-label';
        coordsLabel.textContent = `(${x},${y})`;
        coordsLabel.style.position = 'absolute';
        coordsLabel.style.top = '20px';
        coordsLabel.style.left = '20px';
        coordsLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        coordsLabel.style.color = 'white';
        coordsLabel.style.padding = '2px 5px';
        coordsLabel.style.fontSize = '10px';
        coordsLabel.style.borderRadius = '3px';
        coordsLabel.style.whiteSpace = 'nowrap';
        marker.appendChild(coordsLabel);
        
        // Add it directly to the image container for proper positioning
        puzzleImageContainer.appendChild(marker);
        
        // Log for debugging
        console.log('Marker placed at:', { x, y });
        
        // Check if this is a Misleading_Click puzzle and we're in debug mode
        if (DEBUG_MODE && currentPuzzle && currentPuzzle.puzzle_type === 'Misleading_Click' && currentPuzzle.avoid_area) {
            // Get the avoid area
            const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = currentPuzzle.avoid_area;
            
            // Check if click is within the avoid area
            const inAvoidArea = (
                areaX <= x && x <= areaX + areaWidth &&
                areaY <= y && y <= areaY + areaHeight
            );
            
            // Add status indicator
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'click-status';
            statusIndicator.style.position = 'absolute';
            statusIndicator.style.top = '40px';
            statusIndicator.style.left = '20px';
            statusIndicator.style.padding = '3px 6px';
            statusIndicator.style.borderRadius = '3px';
            statusIndicator.style.fontSize = '10px';
            statusIndicator.style.fontWeight = 'bold';
            
            if (inAvoidArea) {
                statusIndicator.textContent = 'INSIDE AVOID AREA - WRONG';
                statusIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                statusIndicator.style.color = 'white';
                marker.style.borderColor = 'red';
            } else {
                statusIndicator.textContent = 'OUTSIDE AVOID AREA - CORRECT';
                statusIndicator.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
                statusIndicator.style.color = 'black';
                marker.style.borderColor = 'green';
            }
            
            marker.appendChild(statusIndicator);
            
            // Log result
            console.log('Click check:', { inAvoidArea, message: inAvoidArea ? 'INSIDE avoid area (incorrect)' : 'OUTSIDE avoid area (correct)' });
        }
    }

    // Function to set up unusual detection grid
    function setupUnusualDetectionGrid() {
        // Remove any existing grid
        const existingGrid = document.querySelector('.unusual-detection-grid');
        if (existingGrid) {
            existingGrid.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Get the grid dimensions from the current puzzle data
        const gridSize = currentPuzzle.grid_size || [2, 3]; // Default to 2x3 if not specified
        const [rows, cols] = gridSize;
        
        // Create the grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'unusual-detection-grid';
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridContainer.style.gap = '2px';
        gridContainer.style.width = '100%';
        gridContainer.style.aspectRatio = `${cols} / ${rows}`;
        
        // First, load the full image to get its dimensions
        const fullImg = new Image();
        fullImg.onload = () => {
            const imgWidth = fullImg.width;
            const imgHeight = fullImg.height;
            const cellWidth = imgWidth / cols;
            const cellHeight = imgHeight / rows;
            
            // Create individual image elements for each cell
            const totalCells = rows * cols;
            for (let i = 0; i < totalCells; i++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.index = i;
                cell.style.position = 'relative';
                cell.style.border = '2px solid #333';
                cell.style.cursor = 'pointer';
                cell.style.overflow = 'hidden';
                
                // Create an individual image for this cell
                const cellImg = document.createElement('img');
                cellImg.className = 'cell-image';
                cellImg.style.width = '100%';
                cellImg.style.height = '100%';
                cellImg.style.objectFit = 'cover';
                cellImg.style.display = 'block';
                cell.appendChild(cellImg);
                
                // Calculate which part of the source image this cell represents
                const row = Math.floor(i / cols);
                const col = i % cols;
                
                // Create a canvas to extract just this portion of the image
                const canvas = document.createElement('canvas');
                canvas.width = cellWidth;
                canvas.height = cellHeight;
                const ctx = canvas.getContext('2d');
                
                // Draw just the portion we want
                ctx.drawImage(
                    fullImg,
                    col * cellWidth, row * cellHeight, // Source x, y
                    cellWidth, cellHeight, // Source width, height
                    0, 0, // Destination x, y
                    cellWidth, cellHeight // Destination width, height
                );
                
                // Set the cell image source to this canvas data
                cellImg.src = canvas.toDataURL();
                
                // Create an overlay for selection state
                const overlay = document.createElement('div');
                overlay.className = 'cell-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(0, 120, 255, 0.5)';
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s ease';
                overlay.style.pointerEvents = 'none';
                cell.appendChild(overlay);
                
                // Add a checkmark icon to indicate selection
                const checkmark = document.createElement('div');
                checkmark.className = 'checkmark';
                checkmark.innerHTML = '✓';
                checkmark.style.position = 'absolute';
                checkmark.style.top = '50%';
                checkmark.style.left = '50%';
                checkmark.style.transform = 'translate(-50%, -50%)';
                checkmark.style.color = 'white';
                checkmark.style.fontSize = '32px';
                checkmark.style.fontWeight = 'bold';
                checkmark.style.opacity = '0';
                checkmark.style.transition = 'opacity 0.2s ease';
                checkmark.style.pointerEvents = 'none';
                cell.appendChild(checkmark);
                
                // Add click event handler for selection
                cell.addEventListener('click', (e) => {
                    toggleCellSelection(i, cell);
                });
                
                // Add the cell to the grid
                gridContainer.appendChild(cell);
            }
            
            // Add the grid to the puzzle image container
            puzzleImageContainer.appendChild(gridContainer);
            
            // Add a submit button below the grid
            const submitSection = document.createElement('div');
            submitSection.className = 'unusual-submit';
            submitSection.style.textAlign = 'center';
            submitSection.style.marginTop = '15px';
            
            const unusualSubmitBtn = document.createElement('button');
            unusualSubmitBtn.textContent = 'Submit';
            unusualSubmitBtn.className = 'submit-unusual';
            unusualSubmitBtn.addEventListener('click', submitAnswer);
            submitSection.appendChild(unusualSubmitBtn);
            
            // Add to puzzle container
            const imageWrapper = document.querySelector('.puzzle-image-wrapper');
            imageWrapper.appendChild(submitSection);
            
            // Reset selected cells
            selectedCells = [];
        };
        
        // Set the source to load the image
        fullImg.src = currentPuzzle.image_path;
        fullImg.style.display = 'none';
    }
    
    function toggleCellSelection(index, cellElement) {
        // Check if this cell is already selected
        const isSelected = selectedCells.includes(index);
        
        if (isSelected) {
            // Deselect the cell
            selectedCells = selectedCells.filter(i => i !== index);
            cellElement.querySelector('.cell-overlay').style.opacity = '0';
            cellElement.querySelector('.checkmark').style.opacity = '0';
            cellElement.style.transform = 'scale(1)';
            cellElement.style.borderColor = '#333';
        } else {
            // Select the cell
            selectedCells.push(index);
            cellElement.querySelector('.cell-overlay').style.opacity = '1';
            cellElement.querySelector('.checkmark').style.opacity = '1';
            cellElement.style.transform = 'scale(0.95)';
            cellElement.style.borderColor = '#0078ff';
        }
        
        console.log('Selected cells:', selectedCells);
    }

    // Function to set up Bingo swap puzzle
    function setupBingoSwap() {
        // Remove any existing grid
        const existingGrid = document.querySelector('.bingo-grid');
        if (existingGrid) {
            existingGrid.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Get the grid dimensions from the current puzzle data
        const gridSize = currentPuzzle.grid_size || [3, 3]; // Default to 3x3 if not specified
        const [rows, cols] = gridSize;
        
        // Create the grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'bingo-grid';
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridContainer.style.gap = '2px';
        gridContainer.style.width = '100%';
        gridContainer.style.aspectRatio = `${cols} / ${rows}`;
        
        // First, load the full image to get its dimensions
        const fullImg = new Image();
        fullImg.onload = () => {
            const imgWidth = fullImg.width;
            const imgHeight = fullImg.height;
            const cellWidth = imgWidth / cols;
            const cellHeight = imgHeight / rows;
            
            // Create individual image elements for each cell
            const totalCells = rows * cols;
            for (let i = 0; i < totalCells; i++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.index = i;
                cell.style.position = 'relative';
                cell.style.border = '2px solid #333';
                cell.style.cursor = 'pointer';
                cell.style.overflow = 'hidden';
                
                // Create an individual image for this cell
                const cellImg = document.createElement('img');
                cellImg.className = 'cell-image';
                cellImg.style.width = '100%';
                cellImg.style.height = '100%';
                cellImg.style.objectFit = 'cover';
                cellImg.style.display = 'block';
                cell.appendChild(cellImg);
                
                // Calculate which part of the source image this cell represents
                const row = Math.floor(i / cols);
                const col = i % cols;
                
                // Create a canvas to extract just this portion of the image
                const canvas = document.createElement('canvas');
                canvas.width = cellWidth;
                canvas.height = cellHeight;
                const ctx = canvas.getContext('2d');
                
                // Draw just the portion we want
                ctx.drawImage(
                    fullImg,
                    col * cellWidth, row * cellHeight, // Source x, y
                    cellWidth, cellHeight, // Source width, height
                    0, 0, // Destination x, y
                    cellWidth, cellHeight // Destination width, height
                );
                
                // Create a data URL and set it as the image source
                cellImg.src = canvas.toDataURL();
                
                // Create an overlay for selection state
                const overlay = document.createElement('div');
                overlay.className = 'cell-overlay';
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(0, 120, 255, 0.5)';
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.2s ease';
                overlay.style.pointerEvents = 'none';
                cell.appendChild(overlay);
                
                // Add click handler for selection
                cell.addEventListener('click', (e) => {
                    toggleBingoCellSelection(i, cell);
                });
                
                // Add the cell to the grid
                gridContainer.appendChild(cell);
            }
            
            // Add the grid to the puzzle image container
            puzzleImageContainer.appendChild(gridContainer);
            
            // Add a submit button below the grid
            const submitSection = document.createElement('div');
            submitSection.className = 'bingo-submit';
            submitSection.style.textAlign = 'center';
            submitSection.style.marginTop = '15px';
            
            const bingoSubmitBtn = document.createElement('button');
            bingoSubmitBtn.textContent = 'Swap and Submit';
            bingoSubmitBtn.className = 'submit-bingo';
            bingoSubmitBtn.addEventListener('click', () => {
                if (bingoSelectedCells.length === 2) {
                    // Visually swap the cells
                    swapBingoCells();
                    // Submit the answer
                    setTimeout(submitAnswer, 500);
                } else {
                    resultMessage.textContent = 'Please select exactly two cells to swap.';
                    resultMessage.className = 'result-message error';
                }
            });
            submitSection.appendChild(bingoSubmitBtn);
            
            // Add to puzzle container
            const imageWrapper = document.querySelector('.puzzle-image-wrapper');
            imageWrapper.appendChild(submitSection);
            
            // Reset selected cells
            bingoSelectedCells = [];
        };
        
        // Set the source to load the image
        fullImg.src = currentPuzzle.image_path;
        fullImg.style.display = 'none';
    }

    function toggleBingoCellSelection(index, cellElement) {
        const overlay = cellElement.querySelector('.cell-overlay');
        
        // Check if this cell is already selected
        const selectedIndex = bingoSelectedCells.indexOf(index);
        
        if (selectedIndex !== -1) {
            // If already selected, unselect it
            bingoSelectedCells.splice(selectedIndex, 1);
            overlay.style.opacity = '0';
        } else {
            // If we already have 2 selected cells, remove the first one
            if (bingoSelectedCells.length >= 2) {
                const firstCell = document.querySelector(`.grid-cell[data-index="${bingoSelectedCells[0]}"]`);
                if (firstCell) {
                    firstCell.querySelector('.cell-overlay').style.opacity = '0';
                }
                bingoSelectedCells.shift(); // Remove the first element
            }
            
            // Add this cell to selected
            bingoSelectedCells.push(index);
            overlay.style.opacity = '0.5';
        }
        
        console.log('Selected cells for Bingo:', bingoSelectedCells);
    }

    function swapBingoCells() {
        if (bingoSelectedCells.length !== 2) return;
        
        // Get the two cells to swap
        const cell1 = document.querySelector(`.grid-cell[data-index="${bingoSelectedCells[0]}"]`);
        const cell2 = document.querySelector(`.grid-cell[data-index="${bingoSelectedCells[1]}"]`);
        
        if (!cell1 || !cell2) return;
        
        // Get the images inside the cells
        const img1 = cell1.querySelector('.cell-image');
        const img2 = cell2.querySelector('.cell-image');
        
        if (!img1 || !img2) return;
        
        // Swap the image sources
        const tempSrc = img1.src;
        img1.src = img2.src;
        img2.src = tempSrc;
        
        // Apply a highlight to the solution line if it exists
        if (currentPuzzle.solution_line) {
            // Get the answer from the ground truth
            const correctSwaps = currentPuzzle.answer;
            const selectedSwapSet = new Set(bingoSelectedCells);
            
            // Check which solution was achieved by comparing our selection with possible answers
            let solutionKey = null;
            
            // Check vertical solution
            if (currentPuzzle.solution_line.vertical && 
                checkIfSolutionMatches(correctSwaps, selectedSwapSet)) {
                solutionKey = 'vertical';
            } 
            // Check horizontal solution
            else if (currentPuzzle.solution_line.horizontal && 
                checkIfSolutionMatches(correctSwaps, selectedSwapSet)) {
                solutionKey = 'horizontal';
            }
            // Check diagonal solution
            else if (currentPuzzle.solution_line.diagonal && 
                checkIfSolutionMatches(correctSwaps, selectedSwapSet)) {
                solutionKey = 'diagonal';
            }
            
            // If we found a matching solution, highlight it
            if (solutionKey && currentPuzzle.solution_line[solutionKey]) {
                for (const cellIndex of currentPuzzle.solution_line[solutionKey]) {
                    const solutionCell = document.querySelector(`.grid-cell[data-index="${cellIndex}"]`);
                    if (solutionCell) {
                        solutionCell.style.border = '2px solid green';
                    }
                }
            }
        }
    }
    
    // Helper function to check if selected cells match any solution
    function checkIfSolutionMatches(correctSwaps, selectedSwapSet) {
        // Go through each possible correct swap and check if our selection matches any of them
        for (const correctSwap of correctSwaps) {
            const correctSwapSet = new Set(correctSwap);
            // Check if our selected cells match this solution (order doesn't matter)
            if (setsEqual(selectedSwapSet, correctSwapSet)) {
                return true;
            }
        }
        return false;
    }
    
    // Helper function to compare sets for equality
    function setsEqual(set1, set2) {
        if (set1.size !== set2.size) return false;
        for (const item of set1) {
            if (!set2.has(item)) return false;
        }
        return true;
    }

    // // Function to set up the debug mode selector

    // function setupDebugModeSelector() {
    //     // Create the debug selector container
    //     const debugContainer = document.createElement('div');
    //     debugContainer.className = 'debug-selector';
    //     debugContainer.style.marginTop = '10px';
    //     debugContainer.style.marginBottom = '10px';
    //     debugContainer.style.padding = '10px';
    //     debugContainer.style.backgroundColor = '#f0f0f0';
    //     debugContainer.style.borderRadius = '4px';
    //     debugContainer.style.display = 'flex';
    //     debugContainer.style.alignItems = 'center';
    //     debugContainer.style.justifyContent = 'center';
    //     debugContainer.style.flexWrap = 'wrap';
        
    //     // Create a label
    //     const label = document.createElement('label');
    //     label.htmlFor = 'debug-type-selector';
    //     label.textContent = 'Puzzle Type: ';
    //     label.style.marginRight = '10px';
    //     label.style.fontWeight = 'bold';
        
    //     // Create the select element
    //     const select = document.createElement('select');
    //     select.id = 'debug-type-selector';
    //     select.style.padding = '5px';
    //     select.style.marginRight = '10px';
        
    //     // Default option - random puzzles
    //     const defaultOption = document.createElement('option');
    //     defaultOption.value = '';
    //     defaultOption.textContent = 'Random (All Types)';
    //     select.appendChild(defaultOption);
        
    //     // Fetch available CAPTCHA types from the API
    //     fetch('/api/types')
    //         .then(response => response.json())
    //         .then(data => {
    //             if (data.types && data.types.length > 0) {
    //                 // Add options for each CAPTCHA type
    //                 data.types.forEach(type => {
    //                     const option = document.createElement('option');
    //                     option.value = type;
    //                     option.textContent = type;
    //                     select.appendChild(option);
    //                 });
                    
    //                 // Check if there's a debug type in URL parameters
    //                 const urlParams = new URLSearchParams(window.location.search);
    //                 const typeParam = urlParams.get('type');
    //                 if (typeParam) {
    //                     select.value = typeParam;
    //                     debugPuzzleType = typeParam;
    //                 }
    //             }
    //         })
    //         .catch(error => {
    //             console.error('Error fetching CAPTCHA types:', error);
    //         });
        
    //     // Create apply button
    //     const applyBtn = document.createElement('button');
    //     applyBtn.textContent = 'Apply';
    //     applyBtn.style.padding = '5px 10px';
    //     applyBtn.style.backgroundColor = '#4CAF50';
    //     applyBtn.style.color = 'white';
    //     applyBtn.style.border = 'none';
    //     applyBtn.style.borderRadius = '4px';
    //     applyBtn.style.cursor = 'pointer';
        
    //     // Add event listener to the button
    //     applyBtn.addEventListener('click', () => {
    //         debugPuzzleType = select.value;
    //         // Update URL parameter
    //         const url = new URL(window.location);
    //         if (debugPuzzleType) {
    //             url.searchParams.set('type', debugPuzzleType);
    //             // Show the debug indicator
    //             const debugIndicator = document.getElementById('debug-indicator');
    //             const debugTypeDisplay = document.getElementById('debug-type-display');
    //             if (debugIndicator && debugTypeDisplay) {
    //                 debugTypeDisplay.textContent = debugPuzzleType;
    //                 debugIndicator.style.display = 'block';
    //             }
    //         } else {
    //             url.searchParams.delete('type');
    //             // Hide the debug indicator
    //             const debugIndicator = document.getElementById('debug-indicator');
    //             if (debugIndicator) {
    //                 debugIndicator.style.display = 'none';
    //             }
    //         }
    //         window.history.pushState({}, '', url);
            
    //         // Load a new puzzle with the selected type
    //         loadNewPuzzle();
    //     });
        
    //     // Initialize the debug indicator if there's a type parameter
    //     if (debugPuzzleType) {
    //         const debugIndicator = document.getElementById('debug-indicator');
    //         const debugTypeDisplay = document.getElementById('debug-type-display');
    //         if (debugIndicator && debugTypeDisplay) {
    //             debugTypeDisplay.textContent = debugPuzzleType;
    //             debugIndicator.style.display = 'block';
    //         }
    //     }
        
    //     // Add elements to container
    //     debugContainer.appendChild(label);
    //     debugContainer.appendChild(select);
    //     debugContainer.appendChild(applyBtn);
        
    //     // Add container to the benchmark stats section
    //     const benchmarkStats = document.querySelector('.benchmark-stats');
    //     benchmarkStats.parentNode.insertBefore(debugContainer, benchmarkStats.nextSibling);
    // }
     // // Function to set up the debug mode selector



    function loadNewPuzzle() {
        // Reset state
        clickCoordinates = null;
        processingClick = false;
        currentRotationAngle = 0;
        selectedCells = [];
        bingoSelectedCells = [];
        
        // Remove any click markers and debug areas
        const existingMarker = document.querySelector('.click-marker');
        if (existingMarker) {
            existingMarker.remove();
        }
        
        const existingArea = document.querySelector('.debug-area');
        if (existingArea) {
            existingArea.remove();
        }
        
        // Remove any rotation controls
        const existingControls = document.querySelector('.rotation-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        // Remove any existing rotation submit buttons
        const existingRotationSubmit = document.querySelector('.rotation-submit');
        if (existingRotationSubmit) {
            existingRotationSubmit.remove();
        }
        
        // Remove any slider components and submit buttons
        const existingSliderSubmit = document.querySelector('.slider-submit');
        if (existingSliderSubmit) {
            existingSliderSubmit.remove();
        }
        
        // Remove any unusual detection grid and submit buttons
        const existingUnusualSubmit = document.querySelector('.unusual-submit');
        if (existingUnusualSubmit) {
            existingUnusualSubmit.remove();
        }
        
        // Remove any image recognition grid and submit buttons
        const existingImageRecognitionSubmit = document.querySelector('.image-recognition-submit');
        if (existingImageRecognitionSubmit) {
            existingImageRecognitionSubmit.remove();
        }
        
        // Remove any bingo grid and submit buttons
        const existingBingoSubmit = document.querySelector('.bingo-submit');
        if (existingBingoSubmit) {
            existingBingoSubmit.remove();
        }
        
        // After checking and removing existingImageMatchingControls
        const existingImageMatchingControls = document.querySelector('.image-matching-controls');
        if (existingImageMatchingControls) {
            existingImageMatchingControls.remove();
        }
        
        const existingImageMatchingSubmit = document.querySelector('.image-matching-submit');
        if (existingImageMatchingSubmit) {
            existingImageMatchingSubmit.remove();
        }
        
        // Remove any dart count controls and submit buttons
        const existingDartCountSubmit = document.querySelector('.dart-count-submit');
        if (existingDartCountSubmit) {
            existingDartCountSubmit.remove();
        }
        
        // Remove any object match controls and submit buttons
        const existingObjectMatchSubmit = document.querySelector('.object-match-submit');
        if (existingObjectMatchSubmit) {
            existingObjectMatchSubmit.remove();
        }
        
        // Remove any connect icon controls and submit buttons
        const existingConnectIconSubmit = document.querySelector('.connect-icon-submit');
        if (existingConnectIconSubmit) {
            existingConnectIconSubmit.remove();
        }
        
        // Remove any hold button components
        const existingHoldButton = document.querySelector('.hold-button-container');
        if (existingHoldButton) {
            existingHoldButton.remove();
        }
        
        // Reset the puzzle prompt and image
        puzzlePrompt.textContent = 'Loading puzzle...';
        resultMessage.textContent = '';
        resultMessage.className = 'result-message';
        
        // Reset the submit button text
        submitBtn.textContent = 'Submit';
        submitBtn.disabled = false;
        
        // Reset input field display
        userAnswerInput.style.display = 'block';
        
        // Construct URL with debug type parameter if set
        let url = '/api/get_puzzle?mode=sequential';
        // // Function to set up the debug mode selector
        // if (debugPuzzleType) {
        //     url = `/api/get_puzzle?debug_type=${encodeURIComponent(debugPuzzleType)}`;
        // }
        
        // Get a random puzzle from any available type
        fetch(url)
            .then(response => response.json())
            .then(data => {
                console.log("Received puzzle data:", data);
                currentPuzzle = data;
                
                // Update the puzzle prompt
                if (data.prompt) {
                    puzzlePrompt.textContent = data.prompt;
                } else if (data.puzzle_type === 'Dice_Count') {
                    puzzlePrompt.textContent = "Sum up the numbers on all the dice";
                }
                
                // Important: Always display difficulty stars based on puzzle type
                displayDifficultyStars(data.puzzle_type);
                
                // Reset container
                puzzleImageContainer.innerHTML = '';
                
                // Configure input based on puzzle type
                if (data.input_type === 'click') {
                    // Setup for click-based CAPTCHAs (Geometry_Click, Misleading_Click, Pick_Area)
                    puzzleImage.src = data.image_path;
                    inputGroup.style.display = 'none';
                    puzzleImage.style.cursor = 'pointer';
                    puzzleImage.classList.add('clickable');
                    
                    // Add puzzle image back to container
                    if (puzzleImageContainer.innerHTML === '') {
                        puzzleImageContainer.appendChild(puzzleImage);
                    }
                    
                    puzzleImageContainer.style.display = 'block';
                    puzzleImage.style.display = 'block';
                    
                    // Reset click coordinates for new puzzle
                    clickCoordinates = null;
                    
                    // Update prompt text
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else if (data.puzzle_type === 'Geometry_Click') {
                        puzzlePrompt.textContent = "Click on the geometric shape";
                    } else if (data.puzzle_type === 'Misleading_Click') {
                        puzzlePrompt.textContent = "Click the image to continue";
                        
                        // Make sure avoid_area is stored in currentPuzzle object
                        if (data.avoid_area) {
                            currentPuzzle.avoid_area = data.avoid_area;
                            console.log('Loaded avoid_area:', data.avoid_area);
                        }
                    } else if (data.puzzle_type === 'Pick_Area') {
                        puzzlePrompt.textContent = "Click on the largest area outlined by the dotted line";
                    }
                    
                    // For debugging, when image loads, show the target areas
                    puzzleImage.onload = () => {
                        if (DEBUG_MODE) {
                            // Show ground truth area differently based on puzzle type
                            if (data.puzzle_type === 'Pick_Area') {
                                showPickAreaTargets(puzzleImageContainer);
                            } else if (data.puzzle_type === 'Geometry_Click') {
                                fetchAndShowGeometryClickArea(puzzleImageContainer);
                            } else if (data.puzzle_type === 'Misleading_Click') {
                                // For misleading click, show the area to avoid
                                if (data.avoid_area) {
                                    showMisleadingClickArea(puzzleImageContainer, data.avoid_area);
                                }
                            }
                        }
                    };
                } else if (data.input_type === 'rotation') {
                    // Setup for rotation-based CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt first to ensure it's from the rotation puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Use the arrows to rotate the object to match the reference direction.";
                    }
                    
                    // Set up rotation interface
                    setupRotationControls();
                    
                    // Auto-show submit button for rotation puzzles
                    const submitSection = document.createElement('div');
                    submitSection.className = 'rotation-submit';
                    const rotateSubmitBtn = document.createElement('button');
                    rotateSubmitBtn.textContent = 'Submit';
                    rotateSubmitBtn.className = 'submit-rotation';
                    rotateSubmitBtn.addEventListener('click', submitAnswer);
                    submitSection.appendChild(rotateSubmitBtn);
                    
                    // Add to puzzle container
                    const imageWrapper = document.querySelector('.puzzle-image-wrapper');
                    imageWrapper.appendChild(submitSection);
                } else if (data.input_type === 'slide') {
                    // Setup for slide-based CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt for the slide puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Drag the slider component to the correct position.";
                    }
                    
                    // Set up sliding puzzle interface
                    setupSlidePuzzle();
                } else if (data.input_type === 'multiselect') {
                    // Setup for unusual detection CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt for the unusual detection puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Select the unusual items in the image.";
                    }
                    
                    // Set up unusual detection grid
                    setupUnusualDetectionGrid();
                } else if (data.input_type === 'image_grid') {
                    // Setup for image recognition CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt for the image recognition puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else if (data.question) {
                        puzzlePrompt.textContent = data.question;
                    } else {
                        puzzlePrompt.textContent = "Select all images that match the description.";
                    }
                    
                    // Set up image recognition grid
                    setupImageRecognition();
                } else if (data.input_type === 'bingo_swap') {
                    // Setup for Bingo swap CAPTCHA
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt for the Bingo puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Please click two images to exchange their position to line up the same images to a line, you can only exchange the images once.";
                    }
                    
                    // Set up Bingo grid
                    setupBingoSwap();
                } else if (data.input_type === 'image_matching') {
                    // Setup for Image Matching CAPTCHA
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt for the Image Matching puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Using the arrows, match the animal in the left and right image.";
                    }
                    
                    // Set up Image Matching interface
                    setupImageMatching();
                } else if (data.input_type === 'patch_select') {
                    // Hide standard input display but keep it for value storage
                    userAnswerInput.style.display = 'none';
                    
                    // Customize submit button
                    submitBtn.textContent = 'Verify';
                    submitBtn.style.display = 'block';
                    
                    // Setup patch selection grid
                    setupPatchSelectGrid();
                } else if (data.input_type === 'dart_count') {
                    // Hide standard input display but keep it for value storage
                    userAnswerInput.style.display = 'none';
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt for the dart count puzzle
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Use the arrows to find the darts that add up to the target number.";
                    }
                    
                    // Debug log
                    console.log('Setting up Dart Count puzzle with data:', data);
                    
                    // Setup dart count interface
                    setupDartCount();
                } else if (data.input_type === 'select_animal') {
                    // Hide standard input display but keep it for value storage
                    userAnswerInput.style.display = 'none';
                    
                    // Customize submit button
                    submitBtn.textContent = 'Submit';
                    submitBtn.style.display = 'block';
                    
                    // Setup animal selection grid
                    setupSelectAnimalGrid();
                } else if (data.input_type === 'object_match') {
                    // Setup for object match puzzles
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Use the arrows to change the number of objects until it matches the left image.";
                    }
                    
                    // Set up object match interface
                    setupObjectMatch();
                } else if (data.input_type === 'place_dot') {
                    // Setup for Place_Dot CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Click to place a Dot at the end of the car's path";
                    }
                    
                    // Set up place dot interface
                    setupPlaceDot();
                } else if (data.input_type === 'connect_icon') {
                    // Setup for Connect_icon CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Using the arrows, connect the same two icons with the dotted line as shown on the left.";
                    }
                    
                    // Set up connect icon interface
                    setupConnectIcon();
                } else if (data.input_type === 'click_order') {
                    // Setup for Click_Order CAPTCHAs
                    inputGroup.style.display = 'none';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Click the icons in order as shown in the reference image.";
                    }
                    
                    // Set up click order interface
                    setupClickOrder();
                } else if (data.input_type === 'hold_button') {
                    // Setup for Hold_Button CAPTCHAs
                    inputGroup.style.display = 'flex';
                    puzzleImage.style.display = 'none';
                    puzzleImageContainer.style.display = 'block';
                    
                    // Update prompt
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else {
                        puzzlePrompt.textContent = "Hold the button until it finishes loading.";
                    }
                    
                    // Set up hold button interface
                    setupHoldButton();
                    
                    // Ensure input field and submit button are visible
                    userAnswerInput.style.display = 'block';
                    submitBtn.style.display = 'inline-block';
                } else {
                    // Default for text-based CAPTCHAs
                    puzzleImage.src = data.image_path;
                    inputGroup.style.display = 'flex';
                    puzzleImage.style.cursor = 'default';
                    puzzleImage.classList.remove('clickable');
                    
                    // Add puzzle image back to container
                    if (puzzleImageContainer.innerHTML === '') {
                        puzzleImageContainer.appendChild(puzzleImage);
                    }
                    
                    puzzleImageContainer.style.display = 'block';
                    puzzleImage.style.display = 'block';
                    
                    // Update prompt after clearing
                    if (data.prompt) {
                        puzzlePrompt.textContent = data.prompt;
                    } else if (data.puzzle_type === 'Dice_Count') {
                        puzzlePrompt.textContent = "Sum up the numbers on all the dice";
                    }
                    
                    // Reset submit button
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit';
                    
                    // Clear and focus input
                    userAnswerInput.value = '';
                    userAnswerInput.focus();
                    
                    // Set input type based on puzzle type
                    if (data.input_type === 'number') {
                        userAnswerInput.setAttribute('type', 'number');
                        userAnswerInput.setAttribute('placeholder', 'Enter the sum');
                    } else {
                        userAnswerInput.setAttribute('type', 'text');
                        userAnswerInput.setAttribute('placeholder', 'Your answer');
                    }
                    
                    // Ensure the input is visible
                    userAnswerInput.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error loading puzzle:', error);
                // Try again after a delay if there was an error
                setTimeout(loadNewPuzzle, 3000);
            });
    }

    // Function to create fireworks effect for correct answers
    function createFireworks() {
        // Create container for fireworks
        const fireworksContainer = document.createElement('div');
        fireworksContainer.className = 'fireworks-container';
        document.body.appendChild(fireworksContainer);
        
        // Create happy face animation
        const happyFaceContainer = document.createElement('div');
        happyFaceContainer.className = 'happy-face-container';
        happyFaceContainer.textContent = '😄';
        happyFaceContainer.style.zIndex = '10000'; // Ensure it's above everything
        document.body.appendChild(happyFaceContainer);
        
        // Create multiple fireworks at random positions
        const colors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
            '#FF00FF', '#00FFFF', '#FFA500', '#FF4500',
            '#FFD700', '#32CD32', '#8A2BE2', '#FF69B4'
        ];
        
        // Create more fireworks (150 instead of 100)
        for (let i = 0; i < 150; i++) {
            const firework = document.createElement('div');
            firework.className = 'firework';
            
            // Random position - spread across the screen, with more concentration near center
            const centerBias = Math.random() > 0.7; // 30% chance to be centered
            const x = centerBias 
                ? window.innerWidth/2 + (Math.random() - 0.5) * window.innerWidth/2
                : Math.random() * window.innerWidth;
            const y = centerBias
                ? window.innerHeight/2 + (Math.random() - 0.5) * window.innerHeight/2
                : Math.random() * window.innerHeight;
            
            // Random color
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            // Random size (larger particles)
            const size = 5 + Math.random() * 8;
            
            // Random delay and duration
            const delay = Math.random() * 1.5;
            const duration = 0.8 + Math.random() * 1.2;
            
            // Apply styles
            firework.style.left = `${x}px`;
            firework.style.top = `${y}px`;
            firework.style.backgroundColor = color;
            firework.style.width = `${size}px`;
            firework.style.height = `${size}px`;
            firework.style.animationDelay = `${delay}s`;
            firework.style.animationDuration = `${duration}s`;
            
            // Add to container
            fireworksContainer.appendChild(firework);
        }
        
        // Remove containers after animation completes
        setTimeout(() => {
            fireworksContainer.remove();
            happyFaceContainer.remove();
        }, 3500);
    }
    
    // Function to create sad face effect for incorrect answers
    function createSadFace() {
        // Create container for sad face
        const sadFaceContainer = document.createElement('div');
        sadFaceContainer.className = 'sad-face-container';
        sadFaceContainer.textContent = '😢';
        document.body.appendChild(sadFaceContainer);
        
        // Remove container after animation completes
        setTimeout(() => {
            sadFaceContainer.remove();
        }, 2000);
    }

    function submitAnswer() {
        // Don't submit if there's no input for number/text input types
        if ((currentPuzzle.input_type === 'number' || currentPuzzle.input_type === 'text') && 
            !userAnswerInput.value.trim()) {
            // Don't submit empty answers for number/text inputs
            return;
        }
        
        // Disable submit button to prevent double submissions
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        
        let answerData = {
            puzzle_type: currentPuzzle.puzzle_type,
            puzzle_id: currentPuzzle.puzzle_id
        };
        
        // Handle different input types
        if (currentPuzzle.input_type === 'click' && clickCoordinates) {
            // For click input, send the click coordinates
            answerData.answer = clickCoordinates;
        } else if (currentPuzzle.input_type === 'rotation') {
            // For rotation input, send the current rotation angle
            answerData.answer = currentRotationAngle;
        } else if (currentPuzzle.input_type === 'slide') {
            // For slide puzzle, calculate the current position of the slider
            const sliderComponent = document.querySelector('.slider-component');
            if (sliderComponent) {
                // Get the current position (from CSS left/top values)
                const currentX = parseInt(sliderComponent.style.left) || 0;
                const currentY = parseInt(sliderComponent.style.top) || 0;
                
                // Add slider position to answer data
                answerData.answer = [currentX, currentY];
            } else {
                console.error('Slider component not found');
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Check Position';
                return;
            }
        } else if (currentPuzzle.input_type === 'multiselect') {
            // For multiselect input, send the selected cell indices
            answerData.answer = selectedCells;
        } else if (currentPuzzle.input_type === 'image_grid') {
            // For image grid selection, send the selected image indices
            answerData.answer = selectedCells;
        } else if (currentPuzzle.input_type === 'bingo_swap') {
            // For bingo swap, send the selected cells to swap
            answerData.answer = bingoSelectedCells;
        } else if (currentPuzzle.input_type === 'image_matching') {
            // For image matching, send the current option index
            const currentOptionIndex = currentPuzzle.current_option_index || 0;
            answerData.answer = currentOptionIndex;
        } else if (currentPuzzle.input_type === 'dart_count') {
            // For dart count, send the selected option index
            const selectedIndex = parseInt(userAnswerInput.value);
            answerData.answer = selectedIndex;
        } else if (currentPuzzle.input_type === 'patch_select') {
            // For patch select, send the selected patch indices
            try {
                // Try to parse the JSON value from the input
                const parsedSelection = JSON.parse(userAnswerInput.value);
                
                // If parsed array is empty but global selectedCells is not, use global
                if (parsedSelection.length === 0 && selectedCells.length > 0) {
                    answerData.answer = selectedCells;
                } else {
                    answerData.answer = parsedSelection;
                }
            } catch (error) {
                console.error('Error parsing selected patches:', error);
                // Fallback to the global array if parsing fails
                answerData.answer = selectedCells;
            }
        } else if (currentPuzzle.input_type === 'select_animal') {
            // For select animal, send the selected animal index
            try {
                // If the value is empty, use the global selectedAnimalIndex
                if (userAnswerInput.value === '[]' || userAnswerInput.value.trim() === '') {
                    answerData.answer = selectedAnimalIndex >= 0 ? [selectedAnimalIndex] : [];
                } else {
                    // Otherwise parse the JSON from the input
                    const selectedAnimal = JSON.parse(userAnswerInput.value);
                    answerData.answer = selectedAnimal;
                }
            } catch (error) {
                console.error('Error parsing selected animal:', error);
                // Use the global variable as a fallback
                answerData.answer = selectedAnimalIndex >= 0 ? [selectedAnimalIndex] : [];
            }
        } else if (currentPuzzle.input_type === 'object_match') {
            // For object match, send the selected option index
            const selectedIndex = parseInt(puzzleImageContainer.dataset.currentOptionIndex);
            answerData.answer = selectedIndex;
        } else if (currentPuzzle.input_type === 'place_dot') {
            // For place_dot input, send the click coordinates
            if (!clickCoordinates) {
                console.error('No dot coordinates found');
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
                return;
            }
            answerData.answer = clickCoordinates;
        } else if (currentPuzzle.input_type === 'connect_icon') {
            // For connect_icon, send the current option index
            answerData.answer = parseInt(userAnswerInput.value) || 0;
        } else if (currentPuzzle.input_type === 'hold_button') {
            // For hold button, get the elapsed time from the input field
            answerData.answer = parseFloat(userAnswerInput.value) || 0;
            answerData.elapsed_time = ((Date.now() - puzzleStartTime) / 1000).toFixed(2);
        } else {
            // For text/number inputs, use the input value
            answerData.answer = userAnswerInput.value.trim();
        }
        
        // Send answer to server for verification
        fetch('/api/check_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(answerData)
        })
        .then(response => response.json())
        .then(data => {
            // Update stats
            benchmarkStats.total++;
            if (data.correct) {
                benchmarkStats.correct++;
                resultMessage.textContent = 'Correct!';
                resultMessage.className = 'result-message correct';
                
                // Create fireworks effect for correct answer
                createFireworks();
            } else {
                // Just show "Incorrect" without revealing the correct answer
                resultMessage.textContent = 'Incorrect.';
                resultMessage.className = 'result-message incorrect';
                
                // Create sad face effect for incorrect answer
                createSadFace();
            }
            
            updateStats();
            
            // Record benchmark result
            recordBenchmarkResult({
                puzzle_type: currentPuzzle.puzzle_type,
                puzzle_id: currentPuzzle.puzzle_id,
                user_answer: answerData.answer,
                correct_answer: data.correct_answer,
                correct: data.correct
            });
            
            // Disable the submit button after submission
            if (currentPuzzle.input_type !== 'click') {
                submitBtn.disabled = true;
                
                // Also disable rotation submit button if it exists
                const rotateSubmitBtn = document.querySelector('.submit-rotation');
                if (rotateSubmitBtn) {
                    rotateSubmitBtn.disabled = true;
                }
                
                // Also disable image recognition submit button if it exists
                const imageRecognitionSubmitBtn = document.querySelector('.submit-image-recognition');
                if (imageRecognitionSubmitBtn) {
                    imageRecognitionSubmitBtn.disabled = true;
                }
                
                // Also disable bingo submit button if it exists
                const bingoSubmitBtn = document.querySelector('.submit-bingo');
                if (bingoSubmitBtn) {
                    bingoSubmitBtn.disabled = true;
                }
                
                // Also disable image matching submit button if it exists
                const imageMatchingSubmitBtn = document.querySelector('.submit-image-matching');
                if (imageMatchingSubmitBtn) {
                    imageMatchingSubmitBtn.disabled = true;
                }
            }
            
            // After handling the result and before loading a new puzzle
            setTimeout(() => {
                // Reset the submit button text before loading new puzzle
                submitBtn.textContent = 'Submit';
                
                // Make sure we reset input visibility before loading a new puzzle
                userAnswerInput.style.display = 'block';
                
                loadNewPuzzle();
            }, 2000);
        })
        .catch(error => {
            console.error('Error checking answer:', error);
            resultMessage.textContent = 'Error checking answer. Please try again.';
            resultMessage.className = 'result-message incorrect';
            // Re-enable the submit button on error
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        });
    }

    function updateStats() {
        totalCount.textContent = benchmarkStats.total;
        correctCount.textContent = benchmarkStats.correct;
        
        const accuracy = benchmarkStats.total > 0 
            ? ((benchmarkStats.correct / benchmarkStats.total) * 100).toFixed(1) 
            : '0.0';
        
        accuracyEl.textContent = `${accuracy}%`;
    }

    function recordBenchmarkResult(result) {
        // Ensure we have the timestamp field
        if (!result.timestamp) {
            result.timestamp = new Date().toISOString();
        }
        
        // Send the benchmark result to be recorded
        fetch('/api/benchmark_results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Benchmark result recorded:', data);
        })
        .catch(error => {
            console.error('Error recording benchmark result:', error);
        });
    }
    
    // Auto-start benchmark when page loads
    loadNewPuzzle();

    // Function to update position display for the slider
    function updateSliderPositionDisplay(x, y, componentWidth, componentHeight) {
        // Remove any existing position display
        const existingDisplay = document.querySelector('.slider-position-display');
        if (existingDisplay) {
            existingDisplay.remove();
        }
        
        if (!DEBUG_MODE) return;
        
        // Calculate center point
        const centerX = x + (componentWidth / 2);
        const centerY = y + (componentHeight / 2);
        
        // Create the position display element
        const posDisplay = document.createElement('div');
        posDisplay.className = 'slider-position-display';
        posDisplay.textContent = `Position: (${Math.round(centerX)}, ${Math.round(centerY)})`;
        posDisplay.style.position = 'fixed';
        posDisplay.style.top = '10px';
        posDisplay.style.right = '10px';
        posDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        posDisplay.style.color = 'white';
        posDisplay.style.padding = '5px 10px';
        posDisplay.style.borderRadius = '4px';
        posDisplay.style.fontSize = '12px';
        posDisplay.style.zIndex = '1000';
        
        // Add to document body
        document.body.appendChild(posDisplay);
    }

    // Function to set up image recognition grid
    function setupImageRecognition() {
        // Remove any existing grid
        const existingGrid = document.querySelector('.image-recognition-grid');
        if (existingGrid) {
            existingGrid.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Get the grid dimensions
        const gridSize = currentPuzzle.grid_size || [3, 3]; // Default to 3x3 grid
        const [rows, cols] = gridSize;
        
        // Create the grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'image-recognition-grid';
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridContainer.style.gap = '5px';
        gridContainer.style.width = '100%';
        gridContainer.style.aspectRatio = `${cols} / ${rows}`;
        
        // Get the list of images
        const images = currentPuzzle.images || [];
        
        // Create individual cells for each image
        for (let i = 0; i < images.length; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.index = i;
            cell.style.position = 'relative';
            cell.style.border = '2px solid #333';
            cell.style.cursor = 'pointer';
            cell.style.overflow = 'hidden';
            
            // Create image element
            const img = document.createElement('img');
            img.src = images[i];
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.display = 'block';
            cell.appendChild(img);
            
            // Create an overlay for selection state
            const overlay = document.createElement('div');
            overlay.className = 'cell-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0, 120, 255, 0.5)';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease';
            overlay.style.pointerEvents = 'none';
            cell.appendChild(overlay);
            
            // Add a checkmark icon to indicate selection
            const checkmark = document.createElement('div');
            checkmark.className = 'checkmark';
            checkmark.innerHTML = '✓';
            checkmark.style.position = 'absolute';
            checkmark.style.top = '50%';
            checkmark.style.left = '50%';
            checkmark.style.transform = 'translate(-50%, -50%)';
            checkmark.style.color = 'white';
            checkmark.style.fontSize = '32px';
            checkmark.style.fontWeight = 'bold';
            checkmark.style.opacity = '0';
            checkmark.style.transition = 'opacity 0.2s ease';
            checkmark.style.pointerEvents = 'none';
            cell.appendChild(checkmark);
            
            // Add click handler for selection
            cell.addEventListener('click', (e) => {
                toggleCellSelection(i, cell);
            });
            
            // Add the cell to the grid
            gridContainer.appendChild(cell);
        }
        
        // Add the grid to the puzzle image container
        puzzleImageContainer.appendChild(gridContainer);
        
        // Add a submit button below the grid
        const submitSection = document.createElement('div');
        submitSection.className = 'image-recognition-submit';
        submitSection.style.textAlign = 'center';
        submitSection.style.marginTop = '15px';
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit';
        submitBtn.className = 'submit-image-recognition';
        submitBtn.addEventListener('click', submitAnswer);
        submitSection.appendChild(submitBtn);
        
        // Add to puzzle container
        const imageWrapper = document.querySelector('.puzzle-image-wrapper');
        imageWrapper.appendChild(submitSection);
        
        // Reset selected cells
        selectedCells = [];
    }

    // Function to set up Image Matching puzzle
    function setupImageMatching() {
        // Remove any existing controls first
        const existingControls = document.querySelector('.image-matching-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Create a container for the reference image
        const referenceContainer = document.createElement('div');
        referenceContainer.className = 'reference-image-container';
        const referenceImg = document.createElement('img');
        referenceImg.id = 'reference-image';
        referenceImg.src = currentPuzzle.reference_image;
        referenceImg.alt = 'Reference image';
        referenceContainer.appendChild(referenceImg);
        
        // Create a container for the option image
        const optionContainer = document.createElement('div');
        optionContainer.className = 'option-image-container';
        const optionImg = document.createElement('img');
        optionImg.id = 'option-image';
        optionImg.src = currentPuzzle.option_images[0]; // Start with the first option
        optionImg.alt = 'Option image';
        optionContainer.appendChild(optionImg);
        
        // Create a two-column layout for image matching puzzle
        const matchingLayout = document.createElement('div');
        matchingLayout.className = 'matching-layout';
        matchingLayout.appendChild(referenceContainer);
        matchingLayout.appendChild(optionContainer);
        
        // Replace the existing puzzle image
        puzzleImageContainer.innerHTML = '';
        puzzleImageContainer.appendChild(matchingLayout);
        
        // Create navigation controls
        const navControls = document.createElement('div');
        navControls.className = 'image-matching-controls';
        
        // Create left navigation button
        const leftBtn = document.createElement('button');
        leftBtn.className = 'navigate-left';
        leftBtn.innerHTML = '&#9664;'; // Left arrow
        leftBtn.setAttribute('aria-label', 'Previous image');
        
        // Create right navigation button
        const rightBtn = document.createElement('button');
        rightBtn.className = 'navigate-right';
        rightBtn.innerHTML = '&#9654;'; // Right arrow
        rightBtn.setAttribute('aria-label', 'Next image');
        
        // Create indicator dots
        const indicatorContainer = document.createElement('div');
        indicatorContainer.className = 'indicator-dots';
        
        for (let i = 0; i < currentPuzzle.option_images.length; i++) {
            const dot = document.createElement('span');
            dot.className = i === 0 ? 'dot active' : 'dot';
            indicatorContainer.appendChild(dot);
        }
        
        // Add buttons and indicators to controls
        navControls.appendChild(leftBtn);
        navControls.appendChild(indicatorContainer);
        navControls.appendChild(rightBtn);
        
        // Add to puzzle container
        const imageWrapper = document.querySelector('.puzzle-image-wrapper');
        imageWrapper.appendChild(navControls);
        
        // Add event listeners for navigation buttons
        let currentIndex = 0;
        
        leftBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + currentPuzzle.option_images.length) % currentPuzzle.option_images.length;
            updateOptionImage();
        });
        
        rightBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % currentPuzzle.option_images.length;
            updateOptionImage();
        });
        
        function updateOptionImage() {
            // Update the option image
            optionImg.src = currentPuzzle.option_images[currentIndex];
            
            // Update the indicator dots
            const dots = indicatorContainer.querySelectorAll('.dot');
            dots.forEach((dot, i) => {
                dot.className = i === currentIndex ? 'dot active' : 'dot';
            });
            
            // Update the current index in the puzzle data
            currentPuzzle.current_option_index = currentIndex;
        }
        
        // Auto-show submit button for image matching puzzles
        const submitSection = document.createElement('div');
        submitSection.className = 'image-matching-submit';
        const matchingSubmitBtn = document.createElement('button');
        matchingSubmitBtn.textContent = 'Submit';
        matchingSubmitBtn.className = 'submit-image-matching';
        matchingSubmitBtn.addEventListener('click', submitAnswer);
        submitSection.appendChild(matchingSubmitBtn);
        
        // Add to puzzle container
        imageWrapper.appendChild(submitSection);
    }

    // Function to set up patch selection grid
    function setupPatchSelectGrid() {
        // Remove any existing grid first
        const existingGrid = document.querySelector('.patch-select-grid');
        if (existingGrid) {
            existingGrid.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // IMPORTANT: Reset the global selectedCells array to fix the bug
        // when encountering these puzzles multiple times
        selectedCells = [];
        
        // Create a container for the patch select grid
        const gridContainer = document.createElement('div');
        gridContainer.className = 'patch-select-grid';
        
        // Get grid dimensions from the puzzle data
        const gridSize = currentPuzzle.grid_size || [6, 6];
        const rows = gridSize[0];
        const cols = gridSize[1];
        
        // Set grid styles
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridContainer.style.gap = '3px';
        gridContainer.style.width = '100%';
        gridContainer.style.aspectRatio = `${cols}/${rows}`;
        gridContainer.style.position = 'relative';
        
        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'patch-select-image-container';
        imageContainer.style.position = 'absolute';
        imageContainer.style.top = '0';
        imageContainer.style.left = '0';
        imageContainer.style.width = '100%';
        imageContainer.style.height = '100%';
        imageContainer.style.zIndex = '0';
        
        // Add the puzzle image
        const img = document.createElement('img');
        img.src = currentPuzzle.image_path;
        img.alt = 'CAPTCHA image';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        imageContainer.appendChild(img);
        
        // Add image container to grid container
        gridContainer.appendChild(imageContainer);
        
        // Create grid cells for selection
        // Use the global selectedCells array directly
        
        for (let i = 0; i < rows * cols; i++) {
            const cell = document.createElement('div');
            cell.className = 'patch-select-cell';
            cell.dataset.index = i;
            cell.style.position = 'relative';
            cell.style.zIndex = '1';
            cell.style.cursor = 'pointer';
            
            // Add a checkmark icon to indicate selection
            const checkmark = document.createElement('div');
            checkmark.className = 'checkmark';
            checkmark.innerHTML = '✓';
            checkmark.style.position = 'absolute';
            checkmark.style.top = '50%';
            checkmark.style.left = '50%';
            checkmark.style.transform = 'translate(-50%, -50%)';
            checkmark.style.color = 'white';
            checkmark.style.fontSize = '32px';
            checkmark.style.fontWeight = 'bold';
            checkmark.style.opacity = '0';
            checkmark.style.transition = 'opacity 0.2s ease';
            checkmark.style.pointerEvents = 'none';
            checkmark.style.textShadow = '1px 1px 3px rgba(0, 0, 0, 0.7)';
            checkmark.style.zIndex = '3';
            cell.appendChild(checkmark);
            
            // Add click event to toggle selection
            cell.addEventListener('click', () => {
                // Toggle selection
                if (cell.classList.contains('selected')) {
                    cell.classList.remove('selected');
                    // Hide checkmark
                    checkmark.style.opacity = '0';
                    // Remove from selected array
                    const index = selectedCells.indexOf(i);
                    if (index > -1) {
                        selectedCells.splice(index, 1);
                    }
                } else {
                    cell.classList.add('selected');
                    // Show checkmark
                    checkmark.style.opacity = '1';
                    // Add to selected array
                    selectedCells.push(i);
                }
                
                // Update the answer in the UI
                userAnswerInput.value = JSON.stringify(selectedCells);
                
                // Enable the submit button when squares are selected
                submitBtn.disabled = false;
                
                // Log selected patches for debugging
                console.log('Selected patches:', selectedCells);
            });
            
            gridContainer.appendChild(cell);
        }
        
        // Add the grid to the puzzle container
        puzzleImageContainer.appendChild(gridContainer);
        
        // Update the prompt to include the target object
        puzzlePrompt.textContent = `Select all squares with ${currentPuzzle.target_object}`;
        
        // Hide the regular input and replace with verify button
        userAnswerInput.style.display = 'none';
        submitBtn.textContent = 'Verify';
        submitBtn.style.display = 'inline-block';  // Changed to inline-block
        inputGroup.style.display = 'flex';
        submitBtn.disabled = false; // Ensure the button is enabled
        
        // Clear any previous answer
        userAnswerInput.value = '[]';
    }
    
    // Function to set up Select_Animal grid
    function setupSelectAnimalGrid() {
        // Remove any existing grid first
        const existingGrid = document.querySelector('.animal-select-grid');
        if (existingGrid) {
            existingGrid.remove();
        }
        
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // IMPORTANT: Reset the selectedAnimalIndex to -1 to fix the bug when encountering this puzzle multiple times
        selectedAnimalIndex = -1;
        
        // Create a simple container directly
        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.maxWidth = '800px';
        container.style.margin = '0 auto';
        container.style.position = 'relative';
        
        // Display the image directly
        const img = document.createElement('img');
        img.src = currentPuzzle.image_path;
        img.alt = 'CAPTCHA image with animals';
        img.style.width = '100%';
        img.style.display = 'block';
        img.style.border = '2px solid #ccc';
        img.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        container.appendChild(img);
        
        // Get grid dimensions from the puzzle data
        const gridSize = currentPuzzle.grid_size || [2, 3];
        const rows = gridSize[0];
        const cols = gridSize[1];
        
        // Wait for image to load to ensure dimensions are available
        img.onload = function() {
            // Create overlay grid that matches the image dimensions
            const grid = document.createElement('div');
            grid.style.position = 'absolute';
            grid.style.top = '0';
            grid.style.left = '0';
            grid.style.width = '100%';
            grid.style.height = '100%';
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
            grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
            
            // IMPORTANT: Create a fresh selectedAnimal object with -1 index to fix the bug
            // when encountering these puzzles multiple times
            const selectedAnimal = { index: -1 };
            
            for (let i = 0; i < rows * cols; i++) {
                const cell = document.createElement('div');
                cell.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                cell.style.cursor = 'pointer';
                cell.style.position = 'relative';
                cell.style.transition = 'all 0.2s ease';
                
                // Add hover effect
                cell.addEventListener('mouseover', () => {
                    cell.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                    cell.style.border = '1px solid rgba(76, 175, 80, 0.7)';
                });
                
                cell.addEventListener('mouseout', () => {
                    if (selectedAnimal.index !== i) {
                        cell.style.backgroundColor = 'transparent';
                        cell.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                    }
                });
                
                // Add click event to toggle selection
                cell.addEventListener('click', () => {
                    // Clear previous selection
                    grid.querySelectorAll('div').forEach((c, index) => {
                        if (index !== i) {
                            c.style.backgroundColor = 'transparent';
                            c.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                        }
                    });
                    
                    // Update selection
                    selectedAnimal.index = i;
                    selectedAnimalIndex = i; // Update the global variable
                    cell.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
                    cell.style.border = '2px solid rgba(76, 175, 80, 0.9)';
                    
                    // Update the answer in the UI
                    userAnswerInput.value = JSON.stringify([i]);
                    
                    // Enable the submit button
                    submitBtn.disabled = false;
                    
                    // Log selected animal for debugging
                    console.log('Selected animal at index:', i);
                });
                
                grid.appendChild(cell);
            }
            
            // Add the grid to the container
            container.appendChild(grid);
        };
        
        // Add the container to the puzzle container
        puzzleImageContainer.appendChild(container);
        
        // Make sure the prompt is clearly visible
        puzzlePrompt.style.fontSize = '20px';
        puzzlePrompt.style.fontWeight = 'bold';
        puzzlePrompt.style.marginBottom = '20px';
        
        // Update the prompt to include the target animal
        puzzlePrompt.textContent = `Pick a ${currentPuzzle.target_object}`;
        
        // Hide the regular input and replace with verify button
        userAnswerInput.style.display = 'none';
        submitBtn.textContent = 'Submit';
        submitBtn.style.display = 'inline-block';
        inputGroup.style.display = 'flex';
        submitBtn.disabled = true; // Disabled until selection is made
        
        // Clear any previous answer
        userAnswerInput.value = '[]';
    }

    /**
     * Setup the Object Match interface with reference image and option controls
     */
    function setupObjectMatch() {
        // Create container for the object match interface
        const matchContainer = document.createElement('div');
        matchContainer.className = 'object-match-container';
        
        // Create a horizontal layout
        const horizontalLayout = document.createElement('div');
        horizontalLayout.className = 'object-match-horizontal-layout';
        
        // Create reference image container
        const referenceContainer = document.createElement('div');
        referenceContainer.className = 'object-match-reference';
        
        // Add reference image
        const referenceImage = document.createElement('img');
        referenceImage.src = currentPuzzle.reference_image || currentPuzzle.additional_data.reference_image;
        referenceImage.alt = 'Reference Image';
        referenceImage.className = 'object-match-reference-img';
        referenceContainer.appendChild(referenceImage);
        
        // Add reference caption
        const referenceCaption = document.createElement('div');
        referenceCaption.className = 'object-match-caption';
        referenceCaption.textContent = 'Match This!';
        referenceContainer.appendChild(referenceCaption);
        
        // Create options container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'object-match-options';
        
        // Add option image
        const optionImage = document.createElement('img');
        const optionImages = currentPuzzle.option_images || currentPuzzle.additional_data.option_images;
        optionImage.src = optionImages[0]; // Start with first option
        optionImage.alt = 'Option Image';
        optionImage.className = 'object-match-option-img';
        optionsContainer.appendChild(optionImage);
        
        // Create navigation controls
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'object-match-controls';
        
        // Left arrow
        const leftArrow = document.createElement('button');
        leftArrow.innerHTML = '&larr;';
        leftArrow.className = 'object-match-arrow left-arrow';
        leftArrow.addEventListener('click', () => updateObjectOption(-1));
        
        // Right arrow
        const rightArrow = document.createElement('button');
        rightArrow.innerHTML = '&rarr;';
        rightArrow.className = 'object-match-arrow right-arrow';
        rightArrow.addEventListener('click', () => updateObjectOption(1));
        
        // Add arrows to controls
        controlsContainer.appendChild(leftArrow);
        controlsContainer.appendChild(rightArrow);
        
        // Add controls to options container
        optionsContainer.appendChild(controlsContainer);
        
        // Add reference and options to horizontal layout
        horizontalLayout.appendChild(referenceContainer);
        horizontalLayout.appendChild(optionsContainer);
        
        // Add horizontal layout to main container
        matchContainer.appendChild(horizontalLayout);
        
        // Add option indicators (dots)
        const indicators = document.createElement('div');
        indicators.className = 'object-match-indicators';
        
        const numOptions = optionImages.length;
        for (let i = 0; i < numOptions; i++) {
            const dot = document.createElement('span');
            dot.className = 'object-match-dot';
            if (i === 0) {
                dot.classList.add('active');
            }
            indicators.appendChild(dot);
        }
        
        // Add indicators to main container
        matchContainer.appendChild(indicators);
        
        // Add submit button
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit';
        submitBtn.className = 'object-match-submit';
        submitBtn.addEventListener('click', submitAnswer);
        
        // Add containers to puzzle image container
        puzzleImageContainer.appendChild(matchContainer);
        puzzleImageContainer.appendChild(submitBtn);
        
        // Store current index in data attribute
        puzzleImageContainer.dataset.currentOptionIndex = '0';
        
        // Log for debugging
        console.log('Object Match images:', {
            reference: referenceImage.src,
            options: optionImages
        });
    }
    
    /**
     * Update the displayed option image based on navigation direction
     * @param {number} direction - Direction to navigate (-1 for left, 1 for right)
     */
    function updateObjectOption(direction) {
        const container = document.querySelector('.object-match-container');
        const optionImage = document.querySelector('.object-match-option-img');
        const dots = document.querySelectorAll('.object-match-dot');
        
        // Get current index
        let currentIndex = parseInt(puzzleImageContainer.dataset.currentOptionIndex);
        const optionImages = currentPuzzle.option_images || currentPuzzle.additional_data.option_images;
        const numOptions = optionImages.length;
        
        // Calculate new index with wrap-around
        let newIndex = (currentIndex + direction + numOptions) % numOptions;
        
        // Update the option image
        optionImage.src = optionImages[newIndex];
        
        // Update dots
        dots.forEach((dot, index) => {
            if (index === newIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        
        // Store new index
        puzzleImageContainer.dataset.currentOptionIndex = newIndex.toString();
        
        // Store selected answer for submission
        userAnswerInput.value = newIndex.toString();
        
        // Log for debugging
        console.log('Updated option image:', {
            index: newIndex,
            src: optionImage.src
        });
    }

    /**
     * Setup the Place_Dot interface allowing the user to click on the image to place a dot
     */
    function setupPlaceDot() {
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Create a container for the image with relative positioning
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.maxWidth = '800px';
        container.style.margin = '0 auto';
        
        // Create and add the image
        const img = document.createElement('img');
        img.src = `/captcha_data/${currentPuzzle.puzzle_type}/${currentPuzzle.puzzle_id}`;
        img.alt = 'Car path image';
        img.style.width = '100%';
        img.style.display = 'block';
        img.style.cursor = 'crosshair';
        container.appendChild(img);
        
        // Reset any previous click coordinates
        clickCoordinates = null;
        
        // Add click handler to the image
        img.addEventListener('click', (e) => {
            // Remove any existing dot
            const existingDot = container.querySelector('.place-dot-marker');
            if (existingDot) {
                existingDot.remove();
            }
            
            // Get click coordinates relative to the image
            const rect = e.target.getBoundingClientRect();
            const x = Math.round(e.clientX - rect.left);
            const y = Math.round(e.clientY - rect.top);
            
            // Store coordinates for submission
            clickCoordinates = [x, y];
            
            // Create dot marker
            const dot = document.createElement('div');
            dot.className = 'place-dot-marker';
            dot.style.position = 'absolute';
            dot.style.width = '20px';
            dot.style.height = '20px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
            dot.style.border = '2px solid #ff0000';
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;
            dot.style.transform = 'translate(-50%, -50%)';
            dot.style.pointerEvents = 'none';
            dot.style.zIndex = '10';
            
            // Add animation
            dot.style.animation = 'pulse 1s infinite alternate';
            
            // Add dot to container
            container.appendChild(dot);
            
            // Enable submit button
            submitBtn.disabled = false;
            
            // Log coordinates for debugging
            console.log('Dot placed at:', { x, y });
        });
        
        // Add the container to the puzzle container
        puzzleImageContainer.appendChild(container);
        
        // In debug mode, fetch the ground truth to show the target area
        if (DEBUG_MODE) {
            fetch('/api/get_ground_truth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    puzzle_type: currentPuzzle.puzzle_type,
                    puzzle_id: currentPuzzle.puzzle_id
                })
            })
            .then(response => response.json())
            .then(gtData => {
                // Check if we have a target position in the answer
                if (gtData.answer && gtData.answer.target_position) {
                    const targetPosition = gtData.answer.target_position;
                    const tolerance = gtData.answer.tolerance || 15; // Default to 15px
                    showTargetDotArea(container, targetPosition, tolerance);
                }
            })
            .catch(error => {
                console.error('Error fetching ground truth for Place_Dot:', error);
            });
        }
        
        // Update prompt and input elements
        puzzlePrompt.textContent = currentPuzzle.prompt || "Click to place a Dot at the end of the car's path";
        
        // Hide the input field and adjust the submit button
        userAnswerInput.style.display = 'none';
        submitBtn.textContent = 'Submit';
        submitBtn.disabled = true; // Disabled until user places a dot
        submitBtn.style.display = 'inline-block';
        inputGroup.style.display = 'flex';
    }
    
    /**
     * Show the target area for the Place_Dot puzzle in debug mode
     * @param {HTMLElement} container - The container element
     * @param {Array} targetPosition - The target position [x, y]
     * @param {number} tolerance - The tolerance radius in pixels
     */
    function showTargetDotArea(container, targetPosition, tolerance = 15) {
        if (!DEBUG_MODE) return;
        
        // Remove any existing target visualization
        const existingTarget = container.querySelector('.target-dot-area');
        if (existingTarget) {
            existingTarget.remove();
        }
        
        // Get target coordinates
        const [targetX, targetY] = targetPosition;
        
        // Create a target element - visualized as a circle
        const targetArea = document.createElement('div');
        targetArea.className = 'target-dot-area';
        
        // Calculate diameter based on tolerance
        const diameter = tolerance * 2;
        
        // Style the target area
        targetArea.style.position = 'absolute';
        targetArea.style.left = `${targetX - tolerance}px`;
        targetArea.style.top = `${targetY - tolerance}px`;
        targetArea.style.width = `${diameter}px`;
        targetArea.style.height = `${diameter}px`;
        targetArea.style.borderRadius = '50%';
        targetArea.style.border = '2px dashed green';
        targetArea.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        targetArea.style.zIndex = '5';
        targetArea.style.pointerEvents = 'none'; // Allow clicks to pass through
        
        // Add coordinates label
        const coordsLabel = document.createElement('div');
        coordsLabel.className = 'coords-label';
        coordsLabel.textContent = `Target: (${targetX}, ${targetY}) ±${tolerance}px`;
        coordsLabel.style.position = 'absolute';
        coordsLabel.style.top = '-25px';
        coordsLabel.style.left = '0';
        coordsLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        coordsLabel.style.color = 'white';
        coordsLabel.style.padding = '2px 5px';
        coordsLabel.style.fontSize = '10px';
        coordsLabel.style.borderRadius = '3px';
        coordsLabel.style.whiteSpace = 'nowrap';
        targetArea.appendChild(coordsLabel);
        
        // Add to the container
        container.appendChild(targetArea);
        
        // Log the target details
        console.log('Place_Dot target position:', { 
            x: targetX, 
            y: targetY,
            tolerance: tolerance
        });
    }

    // Function to set up connect icon interface
    function setupConnectIcon() {
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Create a layout container for the two-column layout
        const layoutContainer = document.createElement('div');
        layoutContainer.className = 'connect-icon-layout';
        layoutContainer.style.display = 'flex';
        layoutContainer.style.justifyContent = 'space-between';
        
        // Create container for reference image
        const refContainer = document.createElement('div');
        refContainer.className = 'reference-image-container';
        refContainer.style.flex = '1';
        refContainer.style.marginRight = '10px';
        refContainer.style.textAlign = 'center';
        
        // Add "Match This!" label above reference image
        const matchLabel = document.createElement('div');
        matchLabel.className = 'match-label';
        matchLabel.textContent = 'Match This!';
        matchLabel.style.backgroundColor = 'black';
        matchLabel.style.color = 'white';
        matchLabel.style.padding = '2px 5px';
        matchLabel.style.marginBottom = '5px';
        matchLabel.style.fontSize = '12px';
        refContainer.appendChild(matchLabel);
        
        // Add reference image
        const refImg = document.createElement('img');
        refImg.id = 'connect-reference-image';
        refImg.src = currentPuzzle.reference_image;
        refImg.alt = 'Reference image';
        refImg.style.maxWidth = '100%';
        refImg.style.border = '1px solid #ccc';
        refContainer.appendChild(refImg);
        
        // Container for option images with arrows
        const optionContainer = document.createElement('div');
        optionContainer.className = 'connect-option-container';
        optionContainer.style.flex = '1';
        optionContainer.style.position = 'relative';
        
        // Create option image display
        const optionImgContainer = document.createElement('div');
        optionImgContainer.className = 'option-image-container';
        optionImgContainer.style.textAlign = 'center';
        
        // Create option image
        const optionImg = document.createElement('img');
        optionImg.id = 'connect-option-image';
        optionImg.src = currentPuzzle.option_images[0]; // Start with the first option
        optionImg.alt = 'Option image';
        optionImg.style.maxWidth = '100%';
        optionImg.style.border = '1px solid #ccc';
        optionImgContainer.appendChild(optionImg);
        optionContainer.appendChild(optionImgContainer);
        
        // Add arrow navigation
        const arrowsContainer = document.createElement('div');
        arrowsContainer.className = 'connect-arrows-container';
        arrowsContainer.style.display = 'flex';
        arrowsContainer.style.justifyContent = 'center';
        arrowsContainer.style.marginTop = '10px';
        
        // Left arrow
        const leftArrow = document.createElement('button');
        leftArrow.className = 'arrow-btn left-arrow';
        leftArrow.innerHTML = '&#8592;'; // Left arrow character
        leftArrow.setAttribute('aria-label', 'Previous option');
        leftArrow.style.margin = '0 10px';
        leftArrow.style.padding = '5px 15px';
        leftArrow.style.fontSize = '20px';
        leftArrow.style.backgroundColor = '#f0f0f0';
        leftArrow.style.border = '1px solid #ccc';
        leftArrow.style.borderRadius = '4px';
        leftArrow.style.cursor = 'pointer';
        
        // Right arrow
        const rightArrow = document.createElement('button');
        rightArrow.className = 'arrow-btn right-arrow';
        rightArrow.innerHTML = '&#8594;'; // Right arrow character
        rightArrow.setAttribute('aria-label', 'Next option');
        rightArrow.style.margin = '0 10px';
        rightArrow.style.padding = '5px 15px';
        rightArrow.style.fontSize = '20px';
        rightArrow.style.backgroundColor = '#f0f0f0';
        rightArrow.style.border = '1px solid #ccc';
        rightArrow.style.borderRadius = '4px';
        rightArrow.style.cursor = 'pointer';
        
        arrowsContainer.appendChild(leftArrow);
        arrowsContainer.appendChild(rightArrow);
        optionContainer.appendChild(arrowsContainer);
        
        // Add pagination dots
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'pagination-dots';
        dotsContainer.style.display = 'flex';
        dotsContainer.style.justifyContent = 'center';
        dotsContainer.style.marginTop = '10px';
        
        // Create dots based on the number of options
        for (let i = 0; i < currentPuzzle.option_images.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'pagination-dot';
            dot.style.height = '10px';
            dot.style.width = '10px';
            dot.style.margin = '0 5px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = i === 0 ? '#4CAF50' : '#ccc'; // Highlight first dot
            dotsContainer.appendChild(dot);
        }
        
        optionContainer.appendChild(dotsContainer);
        
        // Add all containers to the layout
        layoutContainer.appendChild(refContainer);
        layoutContainer.appendChild(optionContainer);
        puzzleImageContainer.appendChild(layoutContainer);
        
        // Add a submit button
        const submitSection = document.createElement('div');
        submitSection.className = 'connect-icon-submit';
        submitSection.style.textAlign = 'center';
        submitSection.style.marginTop = '15px';
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit';
        submitBtn.className = 'submit-connect';
        submitBtn.style.padding = '10px 20px';
        submitBtn.style.backgroundColor = '#4CAF50';
        submitBtn.style.color = 'white';
        submitBtn.style.border = 'none';
        submitBtn.style.borderRadius = '4px';
        submitBtn.style.fontSize = '16px';
        submitBtn.style.cursor = 'pointer';
        submitBtn.addEventListener('click', submitAnswer);
        submitSection.appendChild(submitBtn);
        
        // Add to puzzle container
        puzzleImageContainer.appendChild(submitSection);
        
        // Set up current option tracking
        let currentOptionIndex = 0;
        
        // Initialize the answer input with the current index
        userAnswerInput.value = currentOptionIndex.toString();
        
        // Function to update the option image
        function updateConnectOptionImage() {
            const optionImg = document.getElementById('connect-option-image');
            if (optionImg) {
                optionImg.src = currentPuzzle.option_images[currentOptionIndex];
            }
            
            // Update dots to highlight current option
            const dots = document.querySelectorAll('.pagination-dot');
            dots.forEach((dot, index) => {
                dot.style.backgroundColor = index === currentOptionIndex ? '#4CAF50' : '#ccc';
            });
            
            // Update the answer input with the current index
            userAnswerInput.value = currentOptionIndex.toString();
        }
        
        // Event listeners for arrows
        leftArrow.addEventListener('click', () => {
            currentOptionIndex = (currentOptionIndex - 1 + currentPuzzle.option_images.length) % currentPuzzle.option_images.length;
            updateConnectOptionImage();
        });
        
        rightArrow.addEventListener('click', () => {
            currentOptionIndex = (currentOptionIndex + 1) % currentPuzzle.option_images.length;
            updateConnectOptionImage();
        });
    }
    
    // Function to set up Click Order interface
    function setupClickOrder() {
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Create a container for the layout
        const layoutContainer = document.createElement('div');
        layoutContainer.className = 'click-order-layout';
        layoutContainer.style.display = 'flex';
        layoutContainer.style.flexDirection = 'column';
        layoutContainer.style.alignItems = 'center';
        
        // Create a container for the main image
        const mainImageContainer = document.createElement('div');
        mainImageContainer.className = 'main-image-container';
        mainImageContainer.style.position = 'relative';
        mainImageContainer.style.marginBottom = '20px';
        mainImageContainer.style.width = '100%';
        
        // Add main image
        const mainImg = document.createElement('img');
        mainImg.id = 'click-order-main-image';
        mainImg.src = currentPuzzle.image_path;
        mainImg.alt = 'Click the icons in order';
        mainImg.style.maxWidth = '100%';
        mainImg.style.border = '1px solid #ccc';
        mainImageContainer.appendChild(mainImg);
        
        // Create a container for the order reference image
        const orderImageContainer = document.createElement('div');
        orderImageContainer.className = 'order-image-container';
        orderImageContainer.style.textAlign = 'center';
        orderImageContainer.style.marginBottom = '20px';
        
        // Add "Order Reference" label
        const orderLabel = document.createElement('div');
        orderLabel.className = 'order-label';
        orderLabel.textContent = 'Click icons in this order:';
        orderLabel.style.backgroundColor = 'black';
        orderLabel.style.color = 'white';
        orderLabel.style.padding = '5px';
        orderLabel.style.marginBottom = '5px';
        orderLabel.style.fontSize = '14px';
        orderImageContainer.appendChild(orderLabel);
        
        // Add order reference image
        const orderImg = document.createElement('img');
        orderImg.id = 'click-order-reference-image';
        orderImg.src = currentPuzzle.order_image;
        orderImg.alt = 'Reference order';
        orderImg.style.maxWidth = '100%';
        orderImg.style.border = '1px solid #ccc';
        orderImageContainer.appendChild(orderImg);
        
        // Add click markers container to show user clicks
        const markersContainer = document.createElement('div');
        markersContainer.className = 'click-markers-container';
        markersContainer.style.position = 'absolute';
        markersContainer.style.top = '0';
        markersContainer.style.left = '0';
        markersContainer.style.width = '100%';
        markersContainer.style.height = '100%';
        markersContainer.style.pointerEvents = 'none'; // Don't block clicks
        mainImageContainer.appendChild(markersContainer);
        
        // Track user clicks
        let userClicks = [];
        
        // Add click indicator
        const clickIndicator = document.createElement('div');
        clickIndicator.className = 'click-indicator';
        clickIndicator.style.marginTop = '10px';
        clickIndicator.style.fontSize = '16px';
        clickIndicator.textContent = 'Clicks: 0';
        
        // Add reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Clicks';
        resetButton.className = 'reset-clicks-btn';
        resetButton.style.padding = '8px 15px';
        resetButton.style.backgroundColor = '#f44336';
        resetButton.style.color = 'white';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '4px';
        resetButton.style.marginRight = '10px';
        resetButton.style.cursor = 'pointer';
        
        // Add click event handler for the main image
        mainImg.addEventListener('click', function(e) {
            // Get click coordinates relative to the image
            const rect = e.target.getBoundingClientRect();
            const x = Math.round(e.clientX - rect.left);
            const y = Math.round(e.clientY - rect.top);
            
            // Add click to the array
            userClicks.push([x, y]);
            
            // Show click marker
            addClickMarker(x, y, userClicks.length, markersContainer);
            
            // Update click indicator
            clickIndicator.textContent = `Clicks: ${userClicks.length}`;
            
            // Enable the dedicated submit button if at least one click has been made
            clickOrderSubmitBtn.disabled = false;
            
            // Log for debugging
            console.log(`Click ${userClicks.length} at:`, { x, y });
        });
        
        // Event listener for reset button
        resetButton.addEventListener('click', function() {
            // Clear user clicks
            userClicks = [];
            
            // Clear markers
            markersContainer.innerHTML = '';
            
            // Update click indicator
            clickIndicator.textContent = 'Clicks: 0';
            
            // Disable submit button
            submitBtn.disabled = true;
        });
        
        // Add components to layout
        layoutContainer.appendChild(orderImageContainer);
        layoutContainer.appendChild(mainImageContainer);
        
        // Add controls container
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.justifyContent = 'center';
        controlsContainer.style.alignItems = 'center';
        controlsContainer.style.marginTop = '15px';
        
        // Add controls to container
        controlsContainer.appendChild(resetButton);
        controlsContainer.appendChild(clickIndicator);
        
        // Add controls to layout
        layoutContainer.appendChild(controlsContainer);
        
        // Create a dedicated submit button for the Click Order puzzle
        const clickOrderSubmitBtn = document.createElement('button');
        clickOrderSubmitBtn.textContent = 'Submit Order';
        clickOrderSubmitBtn.className = 'click-order-submit-btn';
        clickOrderSubmitBtn.style.padding = '10px 20px';
        clickOrderSubmitBtn.style.backgroundColor = '#4CAF50';
        clickOrderSubmitBtn.style.color = 'white';
        clickOrderSubmitBtn.style.border = 'none';
        clickOrderSubmitBtn.style.borderRadius = '4px';
        clickOrderSubmitBtn.style.marginTop = '15px';
        clickOrderSubmitBtn.style.cursor = 'pointer';
        clickOrderSubmitBtn.style.fontSize = '16px';
        clickOrderSubmitBtn.disabled = true; // Disabled until clicks are made
        
        // Add submit button to layout
        layoutContainer.appendChild(clickOrderSubmitBtn);
        
        // Add layout to puzzle container
        puzzleImageContainer.appendChild(layoutContainer);
        
        // Hide the original input field and submit button
        userAnswerInput.style.display = 'none';
        submitBtn.style.display = 'none';
        inputGroup.style.display = 'none';
        
        // Enable the dedicated submit button when clicks are made
        mainImg.addEventListener('click', function() {
            if (userClicks.length > 0) {
                clickOrderSubmitBtn.disabled = false;
            }
        });
        
        // Reset button should disable submit button
        resetButton.addEventListener('click', function() {
            clickOrderSubmitBtn.disabled = true;
        });
        
        // Add event listener to the dedicated submit button
        clickOrderSubmitBtn.addEventListener('click', function() {
            // Set the clicks as the answer
            userAnswerInput.value = JSON.stringify(userClicks);
            
            // Send the data to the server
            fetch('/api/check_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    puzzle_type: currentPuzzle.puzzle_type,
                    puzzle_id: currentPuzzle.puzzle_id,
                    answer: userClicks
                })
            })
            .then(response => response.json())
            .then(data => {
                // Update stats
                benchmarkStats.total++;
                if (data.correct) {
                    benchmarkStats.correct++;
                    resultMessage.textContent = 'Correct!';
                    resultMessage.className = 'result-message correct';
                } else {
                    resultMessage.textContent = 'Incorrect.';
                    resultMessage.className = 'result-message incorrect';
                }
                
                updateStats();
                
                // Record benchmark result
                recordBenchmarkResult({
                    puzzle_type: currentPuzzle.puzzle_type,
                    puzzle_id: currentPuzzle.puzzle_id,
                    user_answer: userClicks,
                    correct_answer: data.correct_answer,
                    correct: data.correct
                });
                
                // Disable the submit button
                clickOrderSubmitBtn.disabled = true;
                
                // Load a new puzzle after a delay
                setTimeout(loadNewPuzzle, 2000);
            })
            .catch(error => {
                console.error('Error checking answer:', error);
                resultMessage.textContent = 'Error checking answer. Please try again.';
                resultMessage.className = 'result-message incorrect';
                // Re-enable the submit button on error
                clickOrderSubmitBtn.disabled = false;
            });
        });
        
        // In debug mode, show the correct click positions
        if (DEBUG_MODE) {
            showClickOrderAnswerPositions(mainImageContainer);
        }
    }
    
    // Function to add a numbered click marker
    function addClickMarker(x, y, number, container) {
        const marker = document.createElement('div');
        marker.className = 'click-marker';
        marker.style.position = 'absolute';
        marker.style.left = `${x - 15}px`;
        marker.style.top = `${y - 15}px`;
        marker.style.width = '30px';
        marker.style.height = '30px';
        marker.style.borderRadius = '50%';
        marker.style.backgroundColor = 'rgba(255, 0, 0, 0.6)';
        marker.style.border = '2px solid white';
        marker.style.color = 'white';
        marker.style.fontWeight = 'bold';
        marker.style.display = 'flex';
        marker.style.justifyContent = 'center';
        marker.style.alignItems = 'center';
        marker.style.fontSize = '14px';
        marker.style.zIndex = '100';
        marker.style.pointerEvents = 'none'; // Don't block future clicks
        marker.textContent = number.toString();
        
        container.appendChild(marker);
    }
    
    // Function to show correct answer positions in debug mode
    function showClickOrderAnswerPositions(container) {
        fetch('/api/get_ground_truth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                puzzle_type: currentPuzzle.puzzle_type,
                puzzle_id: currentPuzzle.puzzle_id
            })
        })
        .then(response => response.json())
        .then(gtData => {
            if (gtData.answer && Array.isArray(gtData.answer)) {
                const correctPositions = gtData.answer;
                const tolerance = currentPuzzle.tolerance || 20;
                
                // Create a debug layer
                const debugLayer = document.createElement('div');
                debugLayer.className = 'debug-layer';
                debugLayer.style.position = 'absolute';
                debugLayer.style.top = '0';
                debugLayer.style.left = '0';
                debugLayer.style.width = '100%';
                debugLayer.style.height = '100%';
                debugLayer.style.pointerEvents = 'none';
                
                // Add correct position indicators
                correctPositions.forEach((pos, index) => {
                    const [x, y] = pos;
                    
                    // Create circle for tolerance area
                    const toleranceCircle = document.createElement('div');
                    toleranceCircle.className = 'tolerance-circle';
                    toleranceCircle.style.position = 'absolute';
                    toleranceCircle.style.left = `${x - tolerance}px`;
                    toleranceCircle.style.top = `${y - tolerance}px`;
                    toleranceCircle.style.width = `${tolerance * 2}px`;
                    toleranceCircle.style.height = `${tolerance * 2}px`;
                    toleranceCircle.style.borderRadius = '50%';
                    toleranceCircle.style.border = '2px dashed green';
                    toleranceCircle.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
                    
                    // Create label with position number
                    const posLabel = document.createElement('div');
                    posLabel.className = 'position-label';
                    posLabel.style.position = 'absolute';
                    posLabel.style.left = `${x}px`;
                    posLabel.style.top = `${y - 20}px`;
                    posLabel.style.transform = 'translate(-50%, -50%)';
                    posLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    posLabel.style.color = 'white';
                    posLabel.style.padding = '2px 5px';
                    posLabel.style.borderRadius = '3px';
                    posLabel.style.fontSize = '10px';
                    posLabel.textContent = `${index + 1}: (${x}, ${y})`;
                    
                    debugLayer.appendChild(toleranceCircle);
                    debugLayer.appendChild(posLabel);
                });
                
                container.appendChild(debugLayer);
            }
        })
        .catch(error => {
            console.error('Error fetching ground truth for Click_Order:', error);
        });
    }
    
    // Function to setup the Hold Button CAPTCHA
    function setupHoldButton() {
        // record the start time
        puzzleStartTime = Date.now();
        // Clear the puzzle image container first
        puzzleImageContainer.innerHTML = '';
        
        // Create a container for the button
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'hold-button-container';
        buttonContainer.style.position = 'relative';
        buttonContainer.style.width = '100%';
        buttonContainer.style.maxWidth = '400px';
        buttonContainer.style.margin = '0 auto';
        buttonContainer.style.textAlign = 'center';
        
        // If the CAPTCHA has an image, show it above the button
        if (currentPuzzle.image_path) {
            const imageElement = document.createElement('img');
            imageElement.src = currentPuzzle.image_path;
            imageElement.alt = 'Hold Button CAPTCHA';
            imageElement.style.display = 'block';
            imageElement.style.width = '100%';
            imageElement.style.maxWidth = '400px';
            imageElement.style.margin = '0 auto 20px';
            imageElement.style.borderRadius = '8px';
            buttonContainer.appendChild(imageElement);
        }
        
        // Create button element
        const button = document.createElement('div');
        button.className = 'hold-button';
        button.style.position = 'relative';
        button.style.width = '100%';
        button.style.height = 'auto';
        button.style.cursor = 'pointer';
        button.style.userSelect = 'none';
        button.style.borderRadius = '50px';
        button.style.border = '3px solid #333';
        button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        button.style.backgroundColor = '#f8f8f8';
        button.style.padding = '30px 0';
        button.style.fontSize = '28px';
        button.style.fontWeight = 'bold';
        button.style.color = '#333';
        button.style.textAlign = 'center';
        button.style.transition = 'background-color 0.3s';
        button.textContent = 'HOLD';
        
        // Create progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'hold-progress';
        progressBar.style.position = 'absolute';
        progressBar.style.left = '0';
        progressBar.style.bottom = '0';
        progressBar.style.height = '8px';
        progressBar.style.width = '0%';
        progressBar.style.backgroundColor = '#4CAF50';
        progressBar.style.transition = 'width 0.1s linear';
        progressBar.style.borderRadius = '0 0 50px 50px';
        
        // Get hold time from data
        const requiredHoldTime = currentPuzzle.hold_time || 3; // Default to 3 seconds
        
        // Variables to track holding
        let isHolding = false;
        let holdStartTime = 0;
        let holdTimer = null;
        let completed = false;
        let currentHoldTime = 0;
        
        // Add event listeners for hold detection
        button.addEventListener('mousedown', startHolding);
        button.addEventListener('touchstart', startHolding);
        document.addEventListener('mouseup', stopHolding);
        document.addEventListener('touchend', stopHolding);
        
        function startHolding(e) {
            if (completed) return;
            
            // Prevent default behaviors for touch
            if (e.type === 'touchstart') {
                e.preventDefault();
            }
            
            isHolding = true;
            holdStartTime = Date.now();
            button.style.backgroundColor = '#e0e0e0';
            
            // Start progress animation
            holdTimer = setInterval(() => {
                if (!isHolding) return;
                
                const elapsedTime = (Date.now() - holdStartTime) / 1000; // in seconds
                currentHoldTime = elapsedTime;
                
                // Update progress bar
                const progress = Math.min((elapsedTime / requiredHoldTime) * 100, 100);
                progressBar.style.width = `${progress}%`;
                
                // Check if hold is complete
                if (elapsedTime >= requiredHoldTime && !completed) {
                    completeHold();
                }
            }, 100); // Update every 100ms
        }
        
        function stopHolding() {
            if (!isHolding || completed) return;
            
            isHolding = false;
            button.style.backgroundColor = '#f8f8f8';
            
            // Reset progress if not completed
            if (!completed) {
                progressBar.style.width = '0%';
                clearInterval(holdTimer);
            }
        }
        
        function completeHold() {
            completed = true;
            clearInterval(holdTimer);
            
            // Change button appearance
            button.style.backgroundColor = '#4CAF50';
            button.style.color = 'white';
            button.textContent = 'COMPLETED';
            
            // Set the user answer to the current hold time
            userAnswerInput.value = currentHoldTime.toFixed(2);
            
            // Enable submit button
            submitBtn.disabled = false;
            resultMessage.textContent = "Button hold completed! Click 'Submit' to continue.";
            resultMessage.className = 'result-message instruction';
        }
        
        // Add the progress bar to button
        button.appendChild(progressBar);
        
        // Add button to container
        buttonContainer.appendChild(button);
        
        // Add to puzzle container
        puzzleImageContainer.appendChild(buttonContainer);
        
        // Reset and clear input field
        userAnswerInput.value = '';
        userAnswerInput.style.display = 'none';
        submitBtn.disabled = false;  // Disable submit button until hold is complete
    }

    // Function to show dotted areas in debug mode for Pick_Area
    function showPickAreaTargets(container) {
        if (!DEBUG_MODE || !currentPuzzle) return;
        
        // Fetch ground truth data to show the correct area
        fetch('/api/get_ground_truth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                puzzle_type: currentPuzzle.puzzle_type,
                puzzle_id: currentPuzzle.puzzle_id
            })
        })
        .then(response => response.json())
        .then(gtData => {
            if (gtData.answer && gtData.answer.area) {
                // Get the area from ground truth
                const areaCoords = gtData.answer.area;
                const areaType = gtData.answer.type || 'largest region';
                
                // Create a marker for the area
                const areaMarker = document.createElement('div');
                areaMarker.className = 'area-marker debug-marker';
                areaMarker.style.position = 'absolute';
                areaMarker.style.border = '3px dashed #ff3333';
                // Use a more transparent background to show the underlying dotted lines
                areaMarker.style.backgroundColor = 'rgba(255, 51, 51, 0.15)';
                areaMarker.style.zIndex = '999';
                // Add border radius to better represent curved areas
                areaMarker.style.borderRadius = '25%';
                
                // Set position and size
                const [topLeft, bottomRight] = areaCoords;
                const [minX, minY] = topLeft;
                const [maxX, maxY] = bottomRight;
                
                areaMarker.style.left = `${minX}px`;
                areaMarker.style.top = `${minY}px`;
                areaMarker.style.width = `${maxX - minX}px`;
                areaMarker.style.height = `${maxY - minY}px`;
                
                // Add a label that better explains what to do
                const label = document.createElement('div');
                label.className = 'debug-label';
                label.style.position = 'absolute';
                label.style.top = '5px';
                label.style.left = '50%';
                label.style.transform = 'translateX(-50%)';
                label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                label.style.color = 'white';
                label.style.padding = '5px 10px';
                label.style.fontSize = '14px';
                label.style.fontWeight = 'bold';
                label.style.borderRadius = '3px';
                label.style.whiteSpace = 'nowrap';
                label.style.textAlign = 'center';
                label.textContent = `${areaType}: (${minX},${minY}) to (${maxX},${maxY})`;
                
                areaMarker.appendChild(label);
                
                // Add a note to explain that the actual area follows the dotted lines
                const note = document.createElement('div');
                note.className = 'area-note';
                note.style.position = 'absolute';
                note.style.bottom = '10px';
                note.style.left = '50%';
                note.style.transform = 'translateX(-50%)';
                note.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                note.style.color = 'white';
                note.style.padding = '5px 10px';
                note.style.fontSize = '12px';
                note.style.borderRadius = '3px';
                note.style.maxWidth = '90%';
                note.style.textAlign = 'center';
                note.textContent = 'Follow the dotted white lines to identify the actual area';
                
                areaMarker.appendChild(note);
                container.appendChild(areaMarker);
                
                // Create indicators to highlight the dotted lines
                // This is a simplistic approach; ideally we would trace the actual dotted lines
                highlightDottedLines(container, areaCoords);
            }
        })
        .catch(error => {
            console.error('Error fetching ground truth for Pick_Area:', error);
        });
    }
    
    // Function to highlight the dotted lines that define the area
    function highlightDottedLines(container, areaCoords) {
        const [topLeft, bottomRight] = areaCoords;
        const [minX, minY] = topLeft;
        const [maxX, maxY] = bottomRight;
        
        // Create a canvas element to draw over the image
        const canvas = document.createElement('canvas');
        canvas.className = 'dotted-line-highlight';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none'; // Don't interfere with clicks
        canvas.style.zIndex = '998'; // Just below the area marker
        
        // Wait for the image to load to get the correct dimensions
        const img = container.querySelector('img');
        if (!img) return;
        
        if (img.complete) {
            setupCanvas();
        } else {
            img.onload = setupCanvas;
        }
        
        function setupCanvas() {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]); // Create a dashed line effect
            
            // Draw a path that approximates the dotted lines
            // This is just a rough approximation - would need image processing to trace actual lines
            ctx.beginPath();
            
            // Top line
            ctx.moveTo(minX, minY);
            ctx.lineTo(maxX, minY);
            
            // Right line
            ctx.moveTo(maxX, minY);
            ctx.lineTo(maxX, maxY);
            
            // Bottom line
            ctx.moveTo(maxX, maxY);
            ctx.lineTo(minX, maxY);
            
            // Left line
            ctx.moveTo(minX, maxY);
            ctx.lineTo(minX, minY);
            
            ctx.stroke();
            
            container.appendChild(canvas);
        }
    }

    // Function to show the area to avoid for Misleading_Click puzzles
    function showMisleadingClickArea(container, avoidArea) {
        if (!DEBUG_MODE || !avoidArea) return;
        
        // Create a marker for the area to avoid
        const areaMarker = document.createElement('div');
        areaMarker.className = 'avoid-area-marker debug-marker';
        areaMarker.style.position = 'absolute';
        areaMarker.style.border = '3px dashed red';
        areaMarker.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        areaMarker.style.zIndex = '999';
        
        // Set position and size
        const { x, y, width, height } = avoidArea;
        areaMarker.style.left = `${x}px`;
        areaMarker.style.top = `${y}px`;
        areaMarker.style.width = `${width}px`;
        areaMarker.style.height = `${height}px`;
        
        // Add a label
        const label = document.createElement('div');
        label.className = 'debug-label';
        label.style.position = 'absolute';
        label.style.top = '-20px';
        label.style.left = '0';
        label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        label.style.color = 'white';
        label.style.padding = '2px 5px';
        label.style.fontSize = '12px';
        label.style.borderRadius = '3px';
        label.textContent = `DO NOT CLICK IN THIS AREA: (${x},${y}) ${width}x${height}`;
        
        // Add a warning sign in the middle
        const warningSign = document.createElement('div');
        warningSign.className = 'warning-sign';
        warningSign.textContent = 'DO NOT CLICK HERE';
        warningSign.style.position = 'absolute';
        warningSign.style.top = '50%';
        warningSign.style.left = '50%';
        warningSign.style.transform = 'translate(-50%, -50%)';
        warningSign.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        warningSign.style.color = '#ff5555';
        warningSign.style.padding = '5px 10px';
        warningSign.style.fontSize = '14px';
        warningSign.style.fontWeight = 'bold';
        warningSign.style.borderRadius = '3px';
        warningSign.style.whiteSpace = 'nowrap';
        warningSign.style.zIndex = '10';
        
        areaMarker.appendChild(label);
        areaMarker.appendChild(warningSign);
        container.appendChild(areaMarker);
        
        console.log('Misleading Click area to avoid:', avoidArea);
    }

    /**
     * Checks if a point is inside a polygon defined by an array of points
     * Uses ray-casting algorithm
     * @param {number} x - X coordinate of the point to check
     * @param {number} y - Y coordinate of the point to check
     * @param {array} polygon - Array of points defining the polygon [[x1,y1], [x2,y2], ...]
     * @returns {boolean} True if the point is inside the polygon
     */
    function pointInPolygon(x, y, polygon) {
        if (!polygon || polygon.length < 3) return false;

        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];
            
            const intersect = ((yi > y) != (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }

    /**
     * Sets up the Dart Count interface with reference number and dart images
     */
    function setupDartCount() {
        // Clear the puzzle image container
        puzzleImageContainer.innerHTML = '';
        
        // Create container for the dart count interface
        const dartContainer = document.createElement('div');
        dartContainer.className = 'dart-count-container';
        
        // Create a horizontal layout
        const horizontalLayout = document.createElement('div');
        horizontalLayout.className = 'dart-count-horizontal-layout';
        
        // Create reference container (shows the target number)
        const referenceContainer = document.createElement('div');
        referenceContainer.className = 'dart-count-reference';
        
        // Add reference image - check all possible locations for data
        const referenceImage = document.createElement('img');
        if (currentPuzzle.additional_data && currentPuzzle.additional_data.reference_image) {
            referenceImage.src = currentPuzzle.additional_data.reference_image;
        } else if (currentPuzzle.reference_image) {
            referenceImage.src = currentPuzzle.reference_image;
        } else {
            console.error('Reference image not found for Dart Count puzzle');
        }
        referenceImage.alt = 'Target Number';
        referenceImage.className = 'dart-count-reference-img';
        referenceContainer.appendChild(referenceImage);
        
        // Add reference caption
        const referenceCaption = document.createElement('div');
        referenceCaption.className = 'dart-count-caption';
        referenceCaption.textContent = 'Find sum of darts equal to this';
        referenceContainer.appendChild(referenceCaption);
        
        // Create options container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'dart-count-options';
        
        // Get option images from all possible locations
        let optionImages = [];
        if (currentPuzzle.additional_data && currentPuzzle.additional_data.option_images) {
            optionImages = currentPuzzle.additional_data.option_images;
        } else if (currentPuzzle.option_images) {
            optionImages = currentPuzzle.option_images;
        } else {
            console.error('Option images not found for Dart Count puzzle');
            optionImages = [];
        }
        
        // Add option image
        const optionImage = document.createElement('img');
        if (optionImages.length > 0) {
            optionImage.src = optionImages[0]; // Start with first option
        }
        optionImage.alt = 'Dart Option';
        optionImage.className = 'dart-count-option-img';
        optionsContainer.appendChild(optionImage);
        
        // Create navigation controls
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'dart-count-controls';
        
        // Left arrow
        const leftArrow = document.createElement('button');
        leftArrow.innerHTML = '&larr;';
        leftArrow.className = 'dart-count-arrow left-arrow';
        leftArrow.addEventListener('click', () => updateDartOption(-1));
        
        // Right arrow
        const rightArrow = document.createElement('button');
        rightArrow.innerHTML = '&rarr;';
        rightArrow.className = 'dart-count-arrow right-arrow';
        rightArrow.addEventListener('click', () => updateDartOption(1));
        
        // Add arrows to controls
        controlsContainer.appendChild(leftArrow);
        controlsContainer.appendChild(rightArrow);
        
        // Add controls to options container
        optionsContainer.appendChild(controlsContainer);
        
        // Add reference and options to horizontal layout
        horizontalLayout.appendChild(referenceContainer);
        horizontalLayout.appendChild(optionsContainer);
        
        // Add horizontal layout to main container
        dartContainer.appendChild(horizontalLayout);
        
        // Add option indicators (dots)
        const indicators = document.createElement('div');
        indicators.className = 'dart-count-indicators';
        
        const numOptions = optionImages.length;
        for (let i = 0; i < numOptions; i++) {
            const dot = document.createElement('span');
            dot.className = 'dart-count-dot';
            if (i === 0) {
                dot.classList.add('active');
            }
            indicators.appendChild(dot);
        }
        
        // Add indicators to main container
        dartContainer.appendChild(indicators);
        
        // Add submit button
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit';
        submitBtn.className = 'dart-count-submit';
        submitBtn.addEventListener('click', submitAnswer);
        
        // Add containers to puzzle image container
        puzzleImageContainer.appendChild(dartContainer);
        puzzleImageContainer.appendChild(submitBtn);
        
        // Store current index in the hidden input for submission
        userAnswerInput.value = '0';
        
        // Log all available data for debugging
        console.log('Dart Count puzzle data:', currentPuzzle);
    }
    
    /**
     * Update the displayed dart option image based on navigation direction
     * @param {number} direction - Direction to navigate (-1 for left, 1 for right)
     */
    function updateDartOption(direction) {
        const optionImage = document.querySelector('.dart-count-option-img');
        const dots = document.querySelectorAll('.dart-count-dot');
        
        // Get option images from all possible locations
        let optionImages = [];
        if (currentPuzzle.additional_data && currentPuzzle.additional_data.option_images) {
            optionImages = currentPuzzle.additional_data.option_images;
        } else if (currentPuzzle.option_images) {
            optionImages = currentPuzzle.option_images;
        } else {
            console.error('Option images not found for Dart Count puzzle');
            return;
        }
        
        // Get current index from input field
        let currentIndex = parseInt(userAnswerInput.value) || 0;
        const numOptions = optionImages.length;
        
        // Calculate new index with wrap-around
        let newIndex = (currentIndex + direction + numOptions) % numOptions;
        
        // Update the option image
        optionImage.src = optionImages[newIndex];
        
        // Update dots
        dots.forEach((dot, index) => {
            if (index === newIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
        
        // Store selected answer for submission
        userAnswerInput.value = newIndex.toString();
        
        // Log for debugging
        console.log('Updated dart option:', {
            index: newIndex,
            src: optionImage.src
        });
    }

    /**
     * Display difficulty stars based on CAPTCHA type
     * @param {string} puzzleType - The type of CAPTCHA puzzle
     */
    function displayDifficultyStars(puzzleType) {
        const difficultyRatings = {
            'Dice_Count': 3,
            'Geometry_Click': 2,
            'Rotation_Match': 4,
            'Slide_Puzzle': 2,
            'Unusual_Detection': 2,
            'Image_Recognition': 3,
            'Bingo': 3,
            'Image_Matching': 2,
            'Patch_Select': 2,
            'Dart_Count': 5,
            'Object_Match': 3,
            'Select_Animal': 1,
            'Coordinates': 4,
            'Path_Finder': 4,
            'Place_Dot': 3,
            'Connect_icon': 4,
            'Click_Order': 4,
            'Hold_Button': 1,
            'Misleading_Click': 1,
            'Pick_Area': 2,
        };

        const difficulty = difficultyRatings[puzzleType] || 1;
        const starsContainer = document.getElementById('difficulty-stars');
        
        // Safety check to ensure the container exists
        if (!starsContainer) {
            console.error('Stars container not found!');
            return;
        }
        
        // Clear the container
        starsContainer.innerHTML = '';

        // Create and append stars
        for (let i = 0; i < 5; i++) {
            const star = document.createElement('span');
            star.className = 'star';
            star.innerHTML = i < difficulty ? '★' : '☆'; // Filled or empty star
            starsContainer.appendChild(star);
        }
        
        // Log for debugging
        console.log(`Displayed ${difficulty} stars for puzzle type: ${puzzleType}`);
    }

    // Function to get a new puzzle
    function getPuzzle(callback) {
        let queryParams = '';
        
        // Check if debug mode is active and add the debug_type parameter if it is
        if (DEBUG_MODE && DEBUG_TYPE) {
            queryParams = `?debug_type=${encodeURIComponent(DEBUG_TYPE)}`;
        }
        
        fetch('/api/get_puzzle' + queryParams)
            .then(response => response.json())
            .then(data => {
                currentPuzzle = data;
                
                // Log the data for debugging
                console.log('Puzzle data:', data);
                
                // Set the prompt and update debug information
                const promptElement = document.getElementById('puzzle-prompt');
                promptElement.textContent = data.prompt;
                
                // Display difficulty stars based on puzzle type
                displayDifficultyStars(data.puzzle_type);
                
                // Update debug indicator if in debug mode
                const debugIndicator = document.getElementById('debug-indicator');
                const debugTypeDisplay = document.getElementById('debug-type-display');
                
                if (DEBUG_MODE && DEBUG_TYPE) {
                    debugIndicator.style.display = 'block';
                    debugTypeDisplay.textContent = DEBUG_TYPE;
                } else {
                    debugIndicator.style.display = 'none';
                }
                
                // Handle different input types
                const imageContainer = document.getElementById('puzzle-image-container');
                const userAnswerInput = document.getElementById('user-answer');
                const submitBtn = document.getElementById('submit-answer');
                
                // Reset the input field and enable submit button
                userAnswerInput.value = '';
                submitBtn.disabled = false;
                
                // Clear any previous result message
                const resultMessage = document.getElementById('result-message');
                resultMessage.textContent = '';
                resultMessage.className = 'result-message';
                
                // Clear the puzzle image container
                imageContainer.innerHTML = '';
                
                // Set up UI based on input type
                if (data.input_type === 'number') {
                    // For numeric input (e.g., Dice_Count)
                    userAnswerInput.type = 'number';
                    userAnswerInput.placeholder = 'Enter number';
                    userAnswerInput.style.display = 'block';
                    submitBtn.style.display = 'block';
                    
                    // Load the image
                    const img = document.createElement('img');
                    img.src = data.image_path;
                    img.alt = 'CAPTCHA Puzzle';
                    img.id = 'puzzle-image';
                    img.onload = function() {
                        imageContainer.appendChild(img);
                    };
                } else if (data.input_type === 'click') {
                    // For click-based puzzles (Geometry_Click, Place_Dot, etc.)
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'none';
                    
                    // Load the image and set up click handler
                    const img = document.createElement('img');
                    img.src = data.image_path;
                    img.alt = 'CAPTCHA Puzzle';
                    img.id = 'puzzle-image';
                    img.onclick = handleImageClick;
                    
                    img.onload = function() {
                        imageContainer.appendChild(img);
                        
                        // For Misleading_Click, show the area to avoid in debug mode
                        if (data.puzzle_type === 'Misleading_Click' && DEBUG_MODE) {
                            showMisleadingClickArea(imageContainer, data.avoid_area);
                        }
                        
                        // For Pick_Area, show the target areas in debug mode
                        if (data.puzzle_type === 'Pick_Area' && DEBUG_MODE) {
                            showPickAreaTargets(imageContainer);
                        }
                    };
                } else if (data.input_type === 'rotation') {
                    // For rotation puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up rotation controls
                    setupRotationControls();
                } else if (data.input_type === 'slide') {
                    // For slide puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up slide puzzle
                    setupSlidePuzzle();
                } else if (data.input_type === 'multiselect') {
                    // For multiple selection puzzles (Unusual_Detection)
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up grid for unusual detection
                    setupUnusualDetectionGrid();
                } else if (data.input_type === 'bingo_swap') {
                    // For bingo swap puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up bingo swap interface
                    setupBingoSwap();
                } else if (data.input_type === 'image_grid') {
                    // For image grid puzzles (Image_Recognition)
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up image recognition grid
                    setupImageRecognition();
                } else if (data.input_type === 'image_matching') {
                    // For image matching puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up image matching interface
                    setupImageMatching();
                } else if (data.input_type === 'patch_select') {
                    // For patch select puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up patch select grid
                    setupPatchSelectGrid();
                } else if (data.input_type === 'dart_count') {
                    // For dart count puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'none';
                    
                    // Set up dart count interface
                    setupDartCount();
                } else if (data.input_type === 'object_match') {
                    // For object match puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up object match interface
                    setupObjectMatch();
                } else if (data.input_type === 'select_animal') {
                    // For animal selection puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up animal selection grid
                    setupSelectAnimalGrid();
                } else if (data.input_type === 'place_dot') {
                    // For place dot puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'none';
                    
                    // Set up place dot interface
                    setupPlaceDot();
                } else if (data.input_type === 'connect_icon') {
                    // For connect icon puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up connect icon interface
                    setupConnectIcon();
                } else if (data.input_type === 'click_order') {
                    // For click order puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up click order interface
                    setupClickOrder();
                } else if (data.input_type === 'hold_button') {
                    // For hold button puzzles
                    userAnswerInput.style.display = 'none';
                    submitBtn.style.display = 'block';
                    
                    // Set up hold button interface
                    setupHoldButton();
                } else {
                    // Default to text input for other types
                    userAnswerInput.type = 'text';
                    userAnswerInput.placeholder = 'Your answer';
                    userAnswerInput.style.display = 'block';
                    submitBtn.style.display = 'block';
                    
                    // Load the image
                    const img = document.createElement('img');
                    img.src = data.image_path;
                    img.alt = 'CAPTCHA Puzzle';
                    img.id = 'puzzle-image';
                    img.onload = function() {
                        imageContainer.appendChild(img);
                    };
                }
                
                // Call the callback if provided
                if (callback && typeof callback === 'function') {
                    callback();
                }
            })
            .catch(error => {
                console.error('Error fetching puzzle:', error);
            });
    }
}); 
