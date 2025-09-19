
function submitChoice(selectedImage) {
    console.log("Submitting choice:", selectedImage);
    
    const selectedInput = document.getElementById('selected-image');
    const choiceForm = document.getElementById('choice-form');
    
    if (!selectedInput || !choiceForm) {
        console.error("Form elements not found");
        return;
    }
    
    // Set the selected image value
    selectedInput.value = selectedImage;
    
    // Visual feedback - fade other patient
    const patientCards = document.querySelectorAll('.patient-card');
    patientCards.forEach(card => {
        const cardImage = card.querySelector('img');
        if (cardImage.src.includes(selectedImage)) {
            card.classList.add('selected');
            cardImage.style.opacity = '1';
        } else {
            cardImage.style.opacity = '0.5';
        }
    });
    
    // Create form data and submit
    const formData = new FormData(choiceForm);
    
    fetch(choiceForm.action, {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log("Response received:", data);
        
        if (data.show_reconsider) {
            showReconsiderModal(data);
        } else {
            console.log("Reloading page...");
            window.location.reload();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Fallback - direct form submission if fetch fails
        choiceForm.submit();
    });
}

function moveDoctor(direction) {
    const doctor = document.getElementById('draggableDoctor');
    const patients = document.querySelectorAll('.patient-card');
    if (!doctor || patients.length < 2) return;

    // NEW: detect RTL and map indices accordingly
    const isRTL =
      document.documentElement.getAttribute('dir') === 'rtl' ||
      getComputedStyle(document.body).direction === 'rtl' ||
      ['ar', 'ur'].includes(localStorage.getItem('selectedLanguage'));

    const leftIndex  = isRTL ? 1 : 0;   // in RTL, DOM[1] is visually left
    const rightIndex = 1 - leftIndex;

    const target = (direction === 'left') ? patients[leftIndex] : patients[rightIndex];

    // (unchanged) animation + movement
    doctor.classList.remove('move-right', 'move-left');
    doctor.classList.add(direction === 'left' ? 'move-left' : 'move-right');
    doctor.style.transition = 'transform 0.5s ease';

    const targetRect = target.getBoundingClientRect();
    const doctorRect = doctor.getBoundingClientRect();

    const moveX = (targetRect.left + targetRect.width / 2)  - (doctorRect.left + doctorRect.width / 2);
    const moveY = (targetRect.top  + targetRect.height / 2) - (doctorRect.top  + doctorRect.height / 2);

    doctor.style.transform = `translate(${moveX}px, ${moveY}px)`;

    setTimeout(() => {
        const patientImage = target.querySelector('.patient-image');
        if (patientImage && patientImage.dataset.filename) {
            submitChoice(patientImage.dataset.filename);
        }
    }, 500);
}


function initDraggableDoctor() {
    const doctor = document.getElementById('draggableDoctor');
    if (!doctor) return;
    
    // Clear any existing transforms/transitions that might interfere
    doctor.style.animation = 'none';
    doctor.style.transition = 'none';
    doctor.style.opacity = '1';
    
    let isDragging = false;
    let startX, startY;
    let initialTransform = { x: 0, y: 0 };
    
    function startDrag(e) {
        // Prevent default to avoid browser's native drag
        e.preventDefault();
        
        // Get initial position - handle both mouse and touch
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;
        
        isDragging = true;
        startX = clientX;
        startY = clientY;
        
        // Get current transform
        const style = window.getComputedStyle(doctor);
        const transform = style.getPropertyValue('transform');
        
        // Parse current transform
        if (transform && transform !== 'none') {
            try {
                const matrix = new DOMMatrix(transform);
                initialTransform.x = matrix.m41;
                initialTransform.y = matrix.m42;
            } catch (e) {
                console.error("Transform parsing error:", e);
                initialTransform = { x: 0, y: 0 };
            }
        }
        
        // Apply visual feedback
        doctor.style.cursor = 'grabbing';
        doctor.style.transition = 'none';
        doctor.classList.add('dragging');
        
        console.log("Drag started", { startX, startY, initialTransform });
    }
    
    function moveDrag(e) {
        if (!isDragging) return;
        
        // Get current position - handle both mouse and touch
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;
        
        // Calculate movement
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        // Apply new position
        const newX = initialTransform.x + dx;
        const newY = initialTransform.y + dy;
        doctor.style.transform = `translate(${newX}px, ${newY}px)`;
        
        // Check for overlap with patients
        checkPatientOverlap(doctor);
        
        console.log("Dragging", { dx, dy, newX, newY });
    }
    
    function stopDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        doctor.style.cursor = 'grab';
        doctor.style.transition = 'transform 0.3s ease';
        doctor.classList.remove('dragging');
        
        console.log("Drag stopped");
    }
    
    function checkPatientOverlap(doctor) {
        const doctorRect = doctor.getBoundingClientRect();
        const patients = document.querySelectorAll('.patient-card');
        
        patients.forEach(patient => {
            const patientRect = patient.getBoundingClientRect();
            
            // Check if rectangles overlap
            if (!(doctorRect.right < patientRect.left || 
                  doctorRect.left > patientRect.right || 
                  doctorRect.bottom < patientRect.top || 
                  doctorRect.top > patientRect.bottom)) {
                
                // Found overlap
                console.log("Overlap detected with patient");
                patient.classList.add('highlight');
                
                // Get the image and submit the choice
                const img = patient.querySelector('.patient-image');
                if (img && img.dataset.filename) {
                    submitChoice(img.dataset.filename);
                    isDragging = false;
                }
            } else {
                patient.classList.remove('highlight');
            }
        });
    }
    
    // Mouse events
    doctor.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', stopDrag);
    
    // Touch events
    doctor.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
    // Prevent browser's native drag
    doctor.addEventListener('dragstart', e => e.preventDefault());
    
    console.log("Doctor draggable initialized");
}


function showReconsiderModal(data) {
    const modal = document.getElementById('reconsider-modal');
    const originalChoice = document.getElementById('original-choice');
    const suggestedChoice = document.getElementById('suggested-choice');
    const originalDesc = document.getElementById('original-choice-description');
    const suggestedDesc = document.getElementById('suggested-choice-description');
   
    // Check if original path includes the resized_images prefix, if not add it
    const originalPath = data.original.includes('resized_images/') 
        ? data.original 
        : `resized_images/${data.original.split('/').pop()}`;
        
    // Set image paths with consistent format
    originalChoice.src = `/static/${originalPath}`;
    suggestedChoice.src = `/static/${data.suggestion}`;

    
    // Set data-filename attributes for translation
    originalChoice.setAttribute('data-filename', data.original.split('/').pop());
    suggestedChoice.setAttribute('data-filename', data.suggestion.split('/').pop());
    
    originalDesc.textContent = data.original_desc;
    suggestedDesc.textContent = data.suggestion_desc;
   
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    if (window.updateModalTranslations) {
        window.updateModalTranslations();
    }
}



function handleReconsider(change) {
    fetch('/reconsider', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            change_decision: change
        })
    }).then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hide the modal
            const modal = document.getElementById('reconsider-modal');
            modal.classList.remove('active');
           
            // Reset the doctor position to center
            const doctor = document.getElementById('draggableDoctor');
            doctor.classList.remove('move-left', 'move-right');
            doctor.style.transform = 'translateX(0)';
           
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // Short delay to allow transition to complete
           
            // Reset opacity of patient cards for new selection
            const patientCards = document.querySelectorAll('.patient-card');
            patientCards.forEach(card => {
                const cardImage = card.querySelector('img');
                cardImage.style.opacity = '1';
                card.classList.remove('selected');
            });
           
            // Show message to user to make final selection using translations
            const instructionText = document.querySelector('.instruction-text p');
            if (instructionText) {
                // Get current language from localStorage
                const currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
                
                // Fetch the translation file
                fetch(`/static/lang/${currentLanguage}.json`)
                    .then(response => response.json())
                    .then(langData => {
                        // Use the translation key for final selection instruction
                        instructionText.textContent = langData.choice_experiment.final_selection_instruction;
                        instructionText.style.fontWeight = "bold";
                        instructionText.style.color = "#007bff";
                    })
                    .catch(err => {
                        // Fallback to English if translation fails
                        console.error('Error loading translation:', err);
                        instructionText.textContent = "Now please make your final selection for which patient to treat.";
                        instructionText.style.fontWeight = "bold";
                        instructionText.style.color = "#007bff";
                    });
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}



document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing doctor movement");
    initDraggableDoctor();
    
    // Animate in the elements
    const patients = document.querySelectorAll('.patient-card');
    patients.forEach((patient, index) => {
        setTimeout(() => {
            patient.style.opacity = '1';
        }, index * 500);
    });
    
    setTimeout(() => {
        const doctor = document.getElementById('draggableDoctor');
        if (doctor) {
            doctor.style.opacity = '1';
        } else {
            console.error("Doctor element not found during animation setup");
        }
    }, 1000);
});


