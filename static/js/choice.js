const ASSET_PREFIX = (() => {
    if (typeof document !== 'undefined' && document.body) {
        const dataset = document.body.dataset || {};
        const prefix = dataset.assetsPrefix;
        if (prefix) {
            return prefix.endsWith('/') ? prefix : `${prefix}/`;
        }
    }
    return '/assets/';
})();

function buildAssetUrl(path) {
    if (!path) {
        return path;
    }

    if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) {
        return path;
    }

    return `${ASSET_PREFIX}${path}`;
}



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
        if (cardImage && cardImage.src.includes(selectedImage)) {
            card.classList.add('selected');
            cardImage.style.opacity = '1';
        } else if (cardImage) {
            cardImage.style.opacity = '0.5';
        }
    });

    const formData = new FormData(choiceForm);

    fetch(choiceForm.action, {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(async (response) => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const contentType = response.headers.get('Content-Type') || '';

        // 👉 CASE 1: backend returns JSON (what we expect for normal flow)
        if (contentType.includes('application/json')) {
            const data = await response.json();
            console.log("JSON response:", data);

            if (data.show_reconsider) {
                // Open the AI reconsider modal
                showReconsiderModal(data);
            } else {
                // Go to the next choice or next page
                window.location.reload();
            }
            return;
        }

        // 👉 CASE 2: backend returned HTML (e.g. rendered AI page or redirect)
        const html = await response.text();
        console.log("Non-JSON response, rendering HTML page");
        document.open();
        document.write(html);
        document.close();
    })
    .catch(error => {
        console.error('Error in submitChoice:', error);
        // Last-resort fallback: normal form submit
        // choiceForm.submit();
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
    const UNLOCK_DELAY_MS = 5000;
    const mobileViewportQuery = window.matchMedia('(max-width: 768px)');

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
    let unlockDelayTimeout = null;
    let unlockScheduled = false;
    const seenPatients = new Set();

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

        if (unlockDelayTimeout) {
            clearTimeout(unlockDelayTimeout);
            unlockDelayTimeout = null;
        }

        doctorUnlocked = true;
        unlockScheduled = false;
        doctor.style.cursor = 'grab';
        hideDoctorLockMessage();

        if (visibilityPoll) {
            clearInterval(visibilityPoll);
            visibilityPoll = null;
        }
    }

    function markPatientRevealed(image, { force = false } = {}) {
        if (!image) {
            return;
        }

        const index = patientImages.indexOf(image);
        if (index === -1) {
            return;
        }

        if (!force) {
            const parentCard = image.closest('.patient-card');
            const isHidden = parentCard?.getAttribute('aria-hidden') === 'true';

            if (mobileViewportQuery.matches && isHidden) {
                return;
            }
        }

        if (seenPatients.has(index)) {
            return;
        }

        image.dataset.revealed = 'true';
        seenPatients.add(index);
        patientsRevealed = seenPatients.size;

        if (seenPatients.size >= patientImages.length) {
            scheduleDoctorUnlock();
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
            markPatientRevealed(targetImage, { force: true });
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

    function scheduleDoctorUnlock() {
        if (doctorUnlocked || unlockScheduled) {
            return;
        }

        unlockScheduled = true;

        if (unlockDelayTimeout) {
            clearTimeout(unlockDelayTimeout);
        }

        unlockDelayTimeout = setTimeout(() => {
            unlockDelayTimeout = null;
            unlockDoctor();
        }, UNLOCK_DELAY_MS);
    }

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
        if (mobileViewportQuery.matches) {
            patientImages.forEach((image, index) => {
                markPatientRevealed(image, { force: index === 0 });
            });
        }

        visibilityPoll = setInterval(evaluatePatientVisibility, 300);

        setTimeout(() => {
            evaluatePatientVisibility();
            if (!doctorUnlocked && !mobileViewportQuery.matches) {
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
    let mobilePrefetched = false;

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

            if (isActive) {
                const image = card.querySelector('.patient-image');
                if (image && !image.dataset.animationInitialized) {
                    image.dataset.animationInitialized = 'true';
                    image.classList.remove('patient-image--instant');
                    void image.offsetWidth;
                }
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
            patientCards.forEach((card, idx) => {
                document.dispatchEvent(new CustomEvent('patientShown', {
                    detail: { index: idx }
                }));

                const image = card.querySelector('.patient-image');
                if (image && !image.dataset.animationInitialized && card.dataset.desktopVisible === 'true') {
                    image.dataset.animationInitialized = 'true';
                    image.classList.remove('patient-image--instant');
                    void image.offsetWidth;
                }
            });
        }

        if (mobileMode && patientCards.length > 1 && !mobilePrefetched) {
            mobilePrefetched = true;
            const originalIndex = targetIndex;
            const nextIndex = (targetIndex + 1) % patientCards.length;

            if (nextIndex !== originalIndex) {
                requestAnimationFrame(() => {
                    applyState(nextIndex, true);
                    requestAnimationFrame(() => {
                        applyState(originalIndex, true);
                    });
                });
            }
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
            mobilePrefetched = false;
            applyState(activeIndex, true);
        } else {
            applyState(activeIndex, false);
            mobilePrefetched = false;
        }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleViewportChange);
    }

    patientCards.forEach(card => {
        if (card.dataset.desktopVisible !== 'true') {
            const image = card.querySelector('.patient-image');
            if (image) {
                image.classList.add('patient-image--instant');
            }
        }
    });

    applyState(activeIndex, mediaQuery.matches);

    if (!mediaQuery.matches) {
        patientCards.forEach((card, idx) => {
            const image = card.querySelector('.patient-image');
            if (image) {
                image.dataset.animationInitialized = 'true';
            }
        });
    }
}


function showReconsiderModal(data) {
    const modal = document.getElementById('reconsider-modal');
    const originalChoice = document.getElementById('original-choice');
    const suggestedChoice = document.getElementById('suggested-choice');
    const originalDesc = document.getElementById('original-choice-description');
    const suggestedDesc = document.getElementById('suggested-choice-description');
    const errorMessage = document.getElementById('reconsider-error');
    const dragOriginalChoice = document.getElementById('drag-original-choice');
    const dragSuggestedChoice = document.getElementById('drag-suggested-choice');
    const dragOriginalDesc = document.getElementById('drag-original-choice-description');
    const dragSuggestedDesc = document.getElementById('drag-suggested-choice-description');
    const modalDoctor = document.getElementById('modal-draggable-doctor');
   
    // Check if original path includes the resized_images prefix, if not add it
    const originalPath = data.original.includes('resized_images/') 
        ? data.original 
        : `resized_images/${data.original.split('/').pop()}`;
        
    // Set image paths with consistent format
    const originalUrl = data.original_url || buildAssetUrl(originalPath);
    const suggestionUrl = data.suggestion_url || buildAssetUrl(data.suggestion);

    originalChoice.src = originalUrl;
    suggestedChoice.src = suggestionUrl;

    if (dragOriginalChoice) {
        dragOriginalChoice.src = originalUrl;
    }

    if (dragSuggestedChoice) {
        dragSuggestedChoice.src = suggestionUrl;
    }

    
    // Set data-filename attributes for translation
    originalChoice.setAttribute('data-filename', data.original.split('/').pop());
    originalChoice.setAttribute('data-fullpath', data.original);
    suggestedChoice.setAttribute('data-filename', data.suggestion.split('/').pop());
    suggestedChoice.setAttribute('data-fullpath', data.suggestion);
    if (dragOriginalChoice) {
        dragOriginalChoice.setAttribute('data-filename', data.original.split('/').pop());
        dragOriginalChoice.setAttribute('data-fullpath', data.original);
    }

    if (dragSuggestedChoice) {
        dragSuggestedChoice.setAttribute('data-filename', data.suggestion.split('/').pop());
        dragSuggestedChoice.setAttribute('data-fullpath', data.suggestion);
    }

    originalDesc.textContent = data.original_desc;
    suggestedDesc.textContent = data.suggestion_desc;
    originalChoice.dataset.description = data.original_desc || '';
    suggestedChoice.dataset.description = data.suggestion_desc || '';
    if (dragOriginalDesc) {
        dragOriginalDesc.textContent = data.original_desc;
    }
    if (dragSuggestedDesc) {
        dragSuggestedDesc.textContent = data.suggestion_desc;
    }
    if (dragOriginalChoice) {
        dragOriginalChoice.dataset.description = data.original_desc || '';
    }
    if (dragSuggestedChoice) {
        dragSuggestedChoice.dataset.description = data.suggestion_desc || '';
    }
    modal.dataset.originalChoice = data.original;
    modal.dataset.suggestedChoice = data.suggestion;

    if (errorMessage) {
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');
    }

    const decisionCards = modal.querySelectorAll('.decision-card');
    decisionCards.forEach(card => {
        card.disabled = false;
        card.classList.remove('decision-card--selected');
        card.onclick = () => finalizeReconsider(card.dataset.decision);
    });

    // Ensure patient tabs are wired up before showing the modal
    initModalPatientSwitchers(modal);

    if (!modal._setReconsiderView) {
        modal._setReconsiderView = createReconsiderViewManager(modal);
    }

    modal._setReconsiderView('overview');

    if (modalDoctor && modalDoctor._modalDragController) {
        modalDoctor._modalDragController.reset();
    }

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    
    if (window.updateModalTranslations) {
        window.updateModalTranslations();
    }

    attachPatientTooltips(modal);
    initModalDoctorDrag(modal);
}


function finalizeReconsider(decision) {
    const modal = document.getElementById('reconsider-modal');
    if (!modal) {
        console.error('Reconsider modal not found');
        return;
    }

    const decisionCards = modal.querySelectorAll('.decision-card');
    const errorMessage = document.getElementById('reconsider-error');

    const setError = message => {
        if (!errorMessage) {
            return;
        }
        errorMessage.textContent = message;
        errorMessage.classList.add('visible');
    };

    if (errorMessage) {
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');
    }

    decisionCards.forEach(card => {
        card.disabled = true;
        if (card.dataset.decision === decision) {
            card.classList.add('decision-card--selected');
        } else {
            card.classList.remove('decision-card--selected');
        }
    });

    const modalDoctor = modal.querySelector('#modal-draggable-doctor');
    if (modalDoctor && modalDoctor._modalDragController) {
        modalDoctor._modalDragController.disable();
    }

    const payload = {
        change_decision: decision === 'switch'
    };

    fetch('/reconsider', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.success) {
                throw new Error(data?.error || 'Unable to save decision');
            }

            modal.classList.remove('active');

            setTimeout(() => {
                modal.style.display = 'none';
                window.location.reload();
            }, 220);
        })
        .catch(error => {
            console.error('Failed to finalize reconsideration:', error);
            decisionCards.forEach(card => {
                card.disabled = false;
                card.classList.remove('decision-card--selected');
            });

            if (modalDoctor && modalDoctor._modalDragController) {
                modalDoctor._modalDragController.reset();
            }

            setError('We could not save your decision. Please try again.');
        });
}



function createReconsiderViewManager(modal) {
    const buttons = Array.from(modal.querySelectorAll('.reconsider-view-btn'));
    const panels = Array.from(modal.querySelectorAll('.reconsider-panel'));

    const setView = targetView => {
        buttons.forEach(button => {
            const isActive = button.dataset.view === targetView;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive.toString());
        });

        panels.forEach(panel => {
            const isActive = panel.dataset.view === targetView;
            panel.classList.toggle('active', isActive);
            if (isActive) {
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', 'hidden');
            }
        });

        if (targetView === 'interactive') {
            // Ensure the drag controller is initialized when switching views
            initModalDoctorDrag(modal);
            const doctor = modal.querySelector('#modal-draggable-doctor');
            if (doctor && doctor._modalDragController) {
                doctor._modalDragController.reset();
            }
        }
    };

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            if (!button.classList.contains('active')) {
                setView(button.dataset.view);
            }
        });
    });

    return setView;
}

function buildInfoDot(container, description) {
    if (!container || !description) {
        return;
    }

    const label = window.__i18n?.choice_experiment?.image_info_label || 'Show patient description';
    const existingWrapper = container.querySelector('.info-dot-wrapper');
    if (existingWrapper) {
        const tooltip = existingWrapper.querySelector('.hover-description');
        const button = existingWrapper.querySelector('.info-dot');
        if (tooltip) {
            tooltip.textContent = description;
        }
        if (button) {
            button.setAttribute('aria-label', label);
        }
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'info-dot-wrapper';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'info-dot';
    button.setAttribute('aria-label', label);
    button.textContent = '?';

    const tooltip = document.createElement('span');
    tooltip.className = 'hover-description';
    tooltip.textContent = description;

    wrapper.appendChild(button);
    wrapper.appendChild(tooltip);
    container.appendChild(wrapper);

    const show = () => wrapper.classList.add('is-open');
    const hide = () => wrapper.classList.remove('is-open');

    button.addEventListener('mouseenter', show);
    button.addEventListener('mouseleave', hide);
    button.addEventListener('focus', show);
    button.addEventListener('blur', hide);
    wrapper.addEventListener('mouseleave', hide);
}

function attachPatientTooltips(root = document) {
    const containers = root.querySelectorAll('.image-container, .decision-visual');
    containers.forEach(container => {
        const img = container.querySelector('img.patient-image');
        if (!img) {
            return;
        }
        if (container.closest('#reconsider-modal')) {
            return;
        }
        const description = img.dataset.description || img.alt || '';
        if (!description) {
            return;
        }
        buildInfoDot(container, description);
    });
}


function initModalDoctorDrag(modal) {
    // Always initialize the tab switchers even if dragging cannot be set up
    initModalPatientSwitchers(modal);

    const doctor = modal.querySelector('#modal-draggable-doctor');
    const dropZone = modal.querySelector('.doctor-drop-zone');
    const dropTargets = modal.querySelectorAll('.reconsider-panel[data-view="interactive"] .drag-target');

    if (!doctor || !dropZone) {
        return;
    }

    if (!doctor._modalDragController) {
        doctor._modalDragController = setupModalDoctorDrag(modal, doctor, dropZone, dropTargets);
    } else {
        doctor._modalDragController.updateTargets(dropTargets);
    }

    doctor._modalDragController.reset();
}


function setupModalDoctorDrag(modal, doctor, dropZone, dropTargets) {
    const state = {
        dropTargets: Array.from(dropTargets),
        isDragging: false,
        disabled: false,
        start: { x: 0, y: 0 },
        origin: { x: 0, y: 0 },
        activeTarget: null,
        touchId: null
    };

    const parseTransform = element => {
        const transform = window.getComputedStyle(element).getPropertyValue('transform');
        if (transform && transform !== 'none') {
            try {
                const matrix = new DOMMatrix(transform);
                return { x: matrix.m41, y: matrix.m42 };
            } catch (error) {
                console.warn('Unable to parse transform', error);
            }
        }
        return { x: 0, y: 0 };
    };

    const applyTransform = (x, y, { animate = false } = {}) => {
        if (animate) {
            doctor.style.transition = 'transform 0.28s ease';
        } else {
            doctor.style.transition = 'none';
        }
        doctor.style.transform = `translate(${x}px, ${y}px)`;
        if (animate) {
            window.setTimeout(() => {
                doctor.style.transition = '';
            }, 300);
        }
    };

    const setHoverTarget = target => {
        if (state.activeTarget === target) {
            return;
        }

        if (state.activeTarget) {
            state.activeTarget.classList.remove('drag-hover');
        }

        state.activeTarget = target;

        if (state.activeTarget) {
            state.activeTarget.classList.add('drag-hover');
        }
    };

    const evaluateHover = () => {
        const doctorRect = doctor.getBoundingClientRect();
        const centerX = doctorRect.left + doctorRect.width / 2;
        const centerY = doctorRect.top + doctorRect.height / 2;

        let hovered = null;
        state.dropTargets.forEach(target => {
            const rect = target.getBoundingClientRect();
            const inside = centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom;
            if (inside) {
                hovered = target;
            }
        });

        setHoverTarget(hovered);
    };

    const animateBackHome = () => {
        applyTransform(0, 0, { animate: true });
        setHoverTarget(null);
    };

    const snapToTarget = target => {
        if (!target) {
            animateBackHome();
            return;
        }

        const doctorRect = doctor.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const deltaX = (targetRect.left + targetRect.width / 2) - (doctorRect.left + doctorRect.width / 2);
        const deltaY = (targetRect.top + targetRect.height / 2) - (doctorRect.top + doctorRect.height / 2);
        const current = parseTransform(doctor);
        applyTransform(current.x + deltaX, current.y + deltaY, { animate: true });

        window.setTimeout(() => {
            finalizeReconsider(target.dataset.decision);
        }, 260);
    };

    const beginDrag = (clientX, clientY) => {
        if (state.disabled || state.isDragging) {
            return false;
        }

        state.isDragging = true;
        doctor.classList.add('dragging');
        doctor.style.cursor = 'grabbing';
        doctor.style.animation = 'none';
        dropZone.classList.add('dragging');
        state.start = { x: clientX, y: clientY };
        state.origin = parseTransform(doctor);
        setHoverTarget(null);
        doctor.style.transition = 'none';
        return true;
    };

    const updateDrag = (clientX, clientY) => {
        if (!state.isDragging) {
            return;
        }

        const dx = clientX - state.start.x;
        const dy = clientY - state.start.y;
        applyTransform(state.origin.x + dx, state.origin.y + dy);
        evaluateHover();
    };

    const endDrag = () => {
        if (!state.isDragging) {
            return;
        }

        state.isDragging = false;
        doctor.classList.remove('dragging');
        doctor.style.cursor = 'grab';
        dropZone.classList.remove('dragging');
        doctor.style.animation = '';

        const target = state.activeTarget;
        setHoverTarget(null);
        snapToTarget(target);
    };

    const onMouseMove = event => {
        updateDrag(event.clientX, event.clientY);
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    const onMouseUp = event => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        endDrag();
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    const onMouseDown = event => {
        if (event.button !== 0) {
            return;
        }

        if (!beginDrag(event.clientX, event.clientY)) {
            return;
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    const stopTouchTracking = () => {
        document.removeEventListener('touchmove', onTouchMove, { passive: false });
        document.removeEventListener('touchend', onTouchEnd, { passive: false });
        document.removeEventListener('touchcancel', onTouchCancel, { passive: false });
        state.touchId = null;
    };

    const onTouchMove = event => {
        const touch = Array.from(event.changedTouches || []).find(({ identifier }) => identifier === state.touchId);
        if (!touch) {
            return;
        }

        updateDrag(touch.clientX, touch.clientY);
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    const onTouchEnd = event => {
        const touch = Array.from(event.changedTouches || []).find(({ identifier }) => identifier === state.touchId);
        if (!touch) {
            return;
        }

        stopTouchTracking();
        endDrag();
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    const onTouchCancel = onTouchEnd;

    const onTouchStart = event => {
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) {
            return;
        }

        if (!beginDrag(touch.clientX, touch.clientY)) {
            return;
        }

        state.touchId = touch.identifier;
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd, { passive: false });
        document.addEventListener('touchcancel', onTouchCancel, { passive: false });
        if (event.cancelable) {
            event.preventDefault();
        }
    };

    doctor.addEventListener('mousedown', onMouseDown);
    doctor.addEventListener('touchstart', onTouchStart, { passive: false });
    doctor.addEventListener('dragstart', event => event.preventDefault());

    applyTransform(0, 0);

    return {
        reset: () => {
            state.disabled = false;
            state.isDragging = false;
            doctor.dataset.disabled = 'false';
            doctor.classList.remove('dragging');
            doctor.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            stopTouchTracking();
            setHoverTarget(null);
            dropZone.classList.remove('dragging');
            applyTransform(0, 0);
        },
        disable: () => {
            state.disabled = true;
            state.isDragging = false;
            doctor.dataset.disabled = 'true';
            doctor.classList.remove('dragging');
            doctor.style.cursor = 'default';
            doctor.style.animation = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            stopTouchTracking();
            setHoverTarget(null);
            dropZone.classList.remove('dragging');
        },
        updateTargets: newTargets => {
            state.dropTargets = Array.from(newTargets);
            setHoverTarget(null);
        }
    };
}


function initModalPatientSwitchers(modal) {
    const switchers = Array.from(modal.querySelectorAll('.reconsider-patient-switcher'));
    if (switchers.length === 0) {
        return;
    }

    const doctor = modal.querySelector('#modal-draggable-doctor');
    const cards = Array.from(modal.querySelectorAll('[data-patient-role]'));

    const stage = modal.querySelector('.interactive-stage');
    const recommendationCard = stage?.querySelector('[data-patient-role="recommendation"]') || null;
    const originalCard = stage?.querySelector('[data-patient-role="original"]') || null;
    const doctorColumn = stage?.querySelector('.doctor-drag-column') || null;

    const updateDoctorTargets = () => {
        if (doctor && doctor._modalDragController) {
            const activeTargets = modal.querySelectorAll('.drag-target--target.is-active');
            const fallbackTargets = modal.querySelectorAll('.drag-target--target');
            doctor._modalDragController.updateTargets(activeTargets.length ? activeTargets : fallbackTargets);
        }
    };

    const setActivePatient = key => {
        switchers.forEach(switcher => {
            switcher.querySelectorAll('.reconsider-switch-btn').forEach(btn => {
                const isActive = btn.dataset.patient === key;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        });

        cards.forEach(card => {
            const isActive = card.dataset.patientRole === key;
            card.classList.toggle('is-active', isActive);
            card.setAttribute('aria-hidden', (!isActive).toString());
            if (typeof card.disabled === 'boolean') {
                card.disabled = !isActive;
            }
            card.tabIndex = isActive ? 0 : -1;
        });

        if (stage && recommendationCard && originalCard && doctorColumn) {
            if (key === 'recommendation') {
                stage.insertBefore(recommendationCard, doctorColumn);
                stage.appendChild(originalCard);
            } else {
                stage.insertBefore(originalCard, doctorColumn);
                stage.appendChild(recommendationCard);
            }
        }

        updateDoctorTargets();
    };

    // Allow other initializers to reuse the setter without duplicating listeners
    modal._setActivePatient = setActivePatient;

    if (modal._patientSwitcherInitialized) {
        setActivePatient('recommendation');
        return;
    }

    modal._patientSwitcherInitialized = true;

    switchers.forEach(switcher => {
        switcher.querySelectorAll('.reconsider-switch-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!btn.classList.contains('active')) {
                    setActivePatient(btn.dataset.patient);
                }
            });
        });
    });

    setActivePatient('recommendation');
}




document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing doctor movement");
    initDraggableDoctor();
    initMobilePatientSwitcher();
    attachPatientTooltips();

    // 🔹 Prevent normal form submit (which causes the 302 document/Redirect)
    const choiceForm = document.getElementById('choice-form');
    if (choiceForm) {
        choiceForm.addEventListener('submit', function (e) {
            e.preventDefault();  // stop browser navigation

            const selectedInput = document.getElementById('selected-image');
            if (!selectedInput || !selectedInput.value) {
                console.warn('Form submitted but no image selected');
                return;
            }

            // Use AJAX flow instead of normal POST
            submitChoice(selectedInput.value);
        });
    }
    
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
