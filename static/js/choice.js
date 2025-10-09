
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

function initDraggableDoctor() {
    const doctor = document.getElementById('draggableDoctor');
    const doctorSection = doctor ? doctor.closest('.doctor-section') : null;
    const patients = Array.from(document.querySelectorAll('.patient-card'));
    const patientImages = patients
        .map(card => card.querySelector('.patient-image'))
        .filter(Boolean);
    const instructionText = document.querySelector('.instruction-text');
    const lockMessageContainer = instructionText || doctorSection;
    const lockMessageId = 'doctor-lock-message';
    let lockMessage = lockMessageContainer ? lockMessageContainer.querySelector(`#${lockMessageId}`) : null;
    const fallbackLockCopy = instructionText?.dataset?.lockMessage || 'please wait for the both patients to show up!';

    if (!doctor || patients.length === 0) {
        return;
    }

    // Clear any existing transforms/transitions that might interfere
    doctor.style.animation = 'none';
    doctor.style.transition = 'none';
    doctor.style.opacity = '1';

    let patientsRevealed = 0;
    let doctorUnlocked = patientImages.length === 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialTransform = { x: 0, y: 0 };
    let activeDropTarget = null;
    let dropTimeout = null;
    let lockMessageTimeout = null;
    let visibilityPoll = null;

    const getLockMessageText = () => {
        const translated = window.__i18n?.choice_experiment?.doctor_lock_message;
        if (typeof translated === 'string' && translated.trim().length > 0) {
            return translated;
        }

        if (instructionText?.dataset?.lockMessage) {
            return instructionText.dataset.lockMessage;
        }

        return fallbackLockCopy;
    };

    const syncLockMessageCopy = newText => {
        const message = typeof newText === 'string' && newText.trim().length > 0 ? newText : getLockMessageText();
        if (instructionText) {
            instructionText.dataset.lockMessage = message;
        }
        if (lockMessage) {
            lockMessage.textContent = message;
        }
        return message;
    };

    window.updateDoctorLockMessageText = function updateDoctorLockMessageText(newText) {
        syncLockMessageCopy(newText);
    };

    if (!lockMessage && lockMessageContainer) {
        lockMessage = document.createElement('div');
        lockMessage.id = lockMessageId;
        lockMessage.className = 'doctor-lock-message';
        lockMessage.setAttribute('role', 'status');
        lockMessage.setAttribute('aria-live', 'polite');
        lockMessage.textContent = getLockMessageText();
        lockMessageContainer.appendChild(lockMessage);
        syncLockMessageCopy(lockMessage.textContent);
    } else {
        syncLockMessageCopy();
    }

    if (!doctorUnlocked) {
        doctor.style.cursor = 'not-allowed';
    }

    function hideDoctorLockMessage() {
        if (!lockMessage) {
            return;
        }

        lockMessage.classList.remove('visible');

        if (lockMessageTimeout) {
            clearTimeout(lockMessageTimeout);
            lockMessageTimeout = null;
        }
    }

    function showDoctorLockMessage() {
        if (!lockMessage) {
            return;
        }

        lockMessage.textContent = getLockMessageText();
        lockMessage.classList.add('visible');

        if (lockMessageTimeout) {
            clearTimeout(lockMessageTimeout);
        }

        lockMessageTimeout = setTimeout(() => {
            hideDoctorLockMessage();
        }, 2400);
    }

    function unlockDoctor() {
        if (doctorUnlocked) {
            return;
        }

        doctorUnlocked = true;
        doctor.style.cursor = 'grab';
        hideDoctorLockMessage();

        if (visibilityPoll) {
            clearInterval(visibilityPoll);
            visibilityPoll = null;
        }
    }

    function markPatientRevealed(image) {
        if (image.dataset.revealed === 'true') {
            return;
        }

        image.dataset.revealed = 'true';
        patientsRevealed += 1;

        if (patientsRevealed >= patientImages.length) {
            unlockDoctor();
        }
    }

    function markPatientByIndex(index) {
        if (index == null) {
            return;
        }

        const numericIndex = Number(index);
        if (Number.isNaN(numericIndex) || numericIndex < 0 || numericIndex >= patientImages.length) {
            return;
        }

        const targetImage = patientImages[numericIndex];
        if (targetImage) {
            markPatientRevealed(targetImage);
        }
    }

    patientImages.forEach(image => {
        const onAnimationStart = event => {
            if (event?.animationName && event.animationName !== 'fadeIn') {
                return;
            }

            markPatientRevealed(image);
            image.removeEventListener('animationstart', onAnimationStart);
        };

        const onAnimationEnd = event => {
            if (event?.animationName && event.animationName !== 'fadeIn') {
                return;
            }

            markPatientRevealed(image);
            image.removeEventListener('animationend', onAnimationEnd);
        };

        const onTransitionEnd = () => {
            markPatientRevealed(image);
            image.removeEventListener('transitionend', onTransitionEnd);
        };

        image.addEventListener('animationstart', onAnimationStart);
        image.addEventListener('animationend', onAnimationEnd);
        image.addEventListener('transitionend', onTransitionEnd);

        const computedStyle = window.getComputedStyle(image);
        const opacityValue = parseFloat(computedStyle.opacity);
        if (opacityValue > 0 && computedStyle.visibility !== 'hidden') {
            markPatientRevealed(image);
            image.removeEventListener('animationstart', onAnimationStart);
            image.removeEventListener('animationend', onAnimationEnd);
            image.removeEventListener('transitionend', onTransitionEnd);
        }
    });

    document.addEventListener('patientShown', event => {
        markPatientByIndex(event?.detail?.index);
    });

    function evaluatePatientVisibility() {
        if (doctorUnlocked) {
            if (visibilityPoll) {
                clearInterval(visibilityPoll);
                visibilityPoll = null;
            }
            return;
        }

        const allVisible = patientImages.every(image => {
            const style = window.getComputedStyle(image);
            return parseFloat(style.opacity) > 0 && style.visibility !== 'hidden';
        });

        if (allVisible) {
            patientImages.forEach(markPatientRevealed);
        }
    }

    if (!doctorUnlocked && patientImages.length > 0) {
        visibilityPoll = setInterval(evaluatePatientVisibility, 300);

        setTimeout(() => {
            evaluatePatientVisibility();
            if (!doctorUnlocked) {
                patientImages.forEach(markPatientRevealed);
            }
        }, 3600);
    } 

    // Unlock time for the doctor to be moveable. 

    function parseTransform(element) {
        const style = window.getComputedStyle(element);
        const transform = style.getPropertyValue('transform');

        if (transform && transform !== 'none') {
            try {
                const matrix = new DOMMatrix(transform);
                return { x: matrix.m41, y: matrix.m42 };
            } catch (error) {
                console.error('Transform parsing error:', error);
            }
        }

        return { x: 0, y: 0 };
    }

    function setActiveDropTarget(target) {
        if (activeDropTarget === target) {
            return;
        }

        if (activeDropTarget) {
            activeDropTarget.classList.remove('highlight');
        }

        activeDropTarget = target;

        if (activeDropTarget) {
            activeDropTarget.classList.add('highlight');
        }
    }

    function findOverlappingPatient() {
        const doctorRect = doctor.getBoundingClientRect();
        const padding = 24; // Allow a little forgiveness for touch input

        return patients.find(patient => {
            if (patient.getAttribute('aria-hidden') === 'true') {
                return false;
            }

            const rect = patient.getBoundingClientRect();
            const extended = {
                top: rect.top - padding,
                right: rect.right + padding,
                bottom: rect.bottom + padding,
                left: rect.left - padding
            };

            const overlapping = !(
                doctorRect.right < extended.left ||
                doctorRect.left > extended.right ||
                doctorRect.bottom < extended.top ||
                doctorRect.top > extended.bottom
            );

            return overlapping;
        }) || null;
    }

    function animateToHome() {
        doctor.style.transition = 'transform 0.35s ease';
        doctor.style.transform = 'translate(0px, 0px)';
        setActiveDropTarget(null);
    }

    function snapToPatient(patient) {
        const patientImage = patient.querySelector('.patient-image');
        if (!patientImage) {
            animateToHome();
            return;
        }

        const payload = patientImage.dataset.fullpath || patientImage.dataset.filename;
        if (!payload) {
            animateToHome();
            return;
        }

        const currentTransform = parseTransform(doctor);
        const doctorRect = doctor.getBoundingClientRect();
        const targetRect = patient.getBoundingClientRect();

        const deltaX = (targetRect.left + targetRect.width / 2) - (doctorRect.left + doctorRect.width / 2);
        const deltaY = (targetRect.top + targetRect.height / 2) - (doctorRect.top + doctorRect.height / 2);

        doctor.style.transition = 'transform 0.35s ease';
        doctor.style.transform = `translate(${currentTransform.x + deltaX}px, ${currentTransform.y + deltaY}px)`;

        if (dropTimeout) {
            clearTimeout(dropTimeout);
        }

        dropTimeout = setTimeout(() => {
            setActiveDropTarget(null);
            submitChoice(payload);
            dropTimeout = null;
        }, 320);
    }

    function startDrag(event) {
        if (!doctorUnlocked) {
            if (event.cancelable) {
                event.preventDefault();
            }

            showDoctorLockMessage();
            return;
        }

        if (dropTimeout) {
            clearTimeout(dropTimeout);
            dropTimeout = null;
        }

        event.preventDefault();

        const pointer = event.touches ? event.touches[0] : event;
        const clientX = pointer?.clientX;
        const clientY = pointer?.clientY;

        if (clientX == null || clientY == null) {
            return;
        }

        isDragging = true;
        startX = clientX;
        startY = clientY;

        initialTransform = parseTransform(doctor);

        doctor.style.cursor = 'grabbing';
        doctor.style.transition = 'none';
        doctor.classList.add('dragging');
        setActiveDropTarget(null);

        if (doctorSection) {
            doctorSection.classList.add('drag-active');
        }
    }

    function moveDrag(event) {
        if (!isDragging) {
            return;
        }

        const pointer = event.touches ? event.touches[0] : event;
        const clientX = pointer?.clientX;
        const clientY = pointer?.clientY;

        if (clientX == null || clientY == null) {
            return;
        }

        if (event.cancelable) {
            event.preventDefault();
        }

        const dx = clientX - startX;
        const dy = clientY - startY;

        const newX = initialTransform.x + dx;
        const newY = initialTransform.y + dy;
        doctor.style.transform = `translate(${newX}px, ${newY}px)`;

        const overlapping = findOverlappingPatient();
        setActiveDropTarget(overlapping);
    }

    function stopDrag() {
        if (!isDragging) {
            return;
        }

        isDragging = false;
        doctor.style.cursor = 'grab';
        doctor.classList.remove('dragging');

        if (doctorSection) {
            doctorSection.classList.remove('drag-active');
        }

        if (activeDropTarget) {
            snapToPatient(activeDropTarget);
        } else {
            animateToHome();
        }
    }

    // Mouse events
    doctor.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', stopDrag);

    // Touch events
    doctor.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    document.addEventListener('touchcancel', stopDrag);

    // Prevent browser's native drag
    doctor.addEventListener('dragstart', e => e.preventDefault());

    console.log('Doctor draggable initialized');
}

function initMobilePatientSwitcher() {
    const switcher = document.getElementById('mobile-patient-switcher');
    const patientCards = Array.from(document.querySelectorAll('.patients-grid > .patient-card'));

    if (!switcher || patientCards.length <= 1) {
        return;
    }

    const buttons = Array.from(switcher.querySelectorAll('.mobile-switch-btn'));
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    let activeIndex = 0;
    let lastAnnouncedIndex = -1;

    const isMobile = () => mediaQuery.matches;

    const applyState = (index, forceMobile) => {
        const mobileMode = forceMobile ?? isMobile();
        const targetIndex = Math.max(0, Math.min(index, patientCards.length - 1));
        activeIndex = targetIndex;

        patientCards.forEach((card, currentIndex) => {
            const isActive = mobileMode ? currentIndex === targetIndex : true;
            if (mobileMode) {
                card.classList.toggle('mobile-active', isActive);
                card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            } else {
                card.classList.remove('mobile-active');
                card.removeAttribute('aria-hidden');
            }
        });

        buttons.forEach((button, currentIndex) => {
            const shouldActivate = mobileMode && currentIndex === targetIndex;
            button.classList.toggle('active', shouldActivate);
            button.setAttribute('aria-pressed', shouldActivate ? 'true' : 'false');
        });

        switcher.classList.toggle('is-mobile-visible', mobileMode);

        if (mobileMode && targetIndex !== lastAnnouncedIndex) {
            lastAnnouncedIndex = targetIndex;
            document.dispatchEvent(new CustomEvent('patientShown', {
                detail: { index: targetIndex }
            }));
        }

        if (!mobileMode && lastAnnouncedIndex !== -1) {
            lastAnnouncedIndex = -1;
            patientCards.forEach((_, idx) => {
                document.dispatchEvent(new CustomEvent('patientShown', {
                    detail: { index: idx }
                }));
            });
        }
    };

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const index = Number(button.dataset.patientIndex);
            if (!Number.isNaN(index)) {
                applyState(index, true);
            }
        });
    });

    const handleViewportChange = event => {
        if (event.matches) {
            applyState(activeIndex, true);
        } else {
            applyState(activeIndex, false);
        }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleViewportChange);
    }

    applyState(activeIndex, mediaQuery.matches);
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
    originalChoice.setAttribute('data-fullpath', data.original);
    suggestedChoice.setAttribute('data-filename', data.suggestion.split('/').pop());
    suggestedChoice.setAttribute('data-fullpath', data.suggestion);
    
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
            if (doctor) {
                const doctorSection = doctor.closest('.doctor-section');
                doctor.classList.remove('dragging');
                doctor.style.transition = 'transform 0.35s ease';
                doctor.style.transform = 'translate(0px, 0px)';
                if (doctorSection) {
                    doctorSection.classList.remove('drag-active');
                }
            }
           
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // Short delay to allow transition to complete
           
            // Reset opacity of patient cards for new selection
            const patientCards = document.querySelectorAll('.patient-card');
            patientCards.forEach(card => {
                const cardImage = card.querySelector('img');
                cardImage.style.opacity = '1';
                card.classList.remove('selected');
                card.classList.remove('highlight');
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
    initMobilePatientSwitcher();
    
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
