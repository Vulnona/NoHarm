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

const DEFAULT_DOCTOR_LOCK_MESSAGE = 'Please take your time to inspect both patients carefully!';
const DOCTOR_UNLOCK_DELAY_MS = 5000;
const LOCK_MESSAGE_DURATION_MS = 2400;

function getDoctorLockMessageText() {
    const translated = window.__i18n?.choice_experiment?.doctor_lock_message;
    if (typeof translated === 'string' && translated.trim().length > 0) {
        return translated.trim();
    }

    const datasetMessage = document.querySelector('.instruction-text')?.dataset?.lockMessage;
    if (typeof datasetMessage === 'string' && datasetMessage.trim().length > 0) {
        return datasetMessage.trim();
    }

    return DEFAULT_DOCTOR_LOCK_MESSAGE;
}

function syncDoctorLockMessages(newText) {
    const message = typeof newText === 'string' && newText.trim().length > 0
        ? newText.trim()
        : getDoctorLockMessageText();
    const instructionText = document.querySelector('.instruction-text');
    if (instructionText) {
        instructionText.dataset.lockMessage = message;
    }
    document.querySelectorAll('.doctor-lock-message').forEach(element => {
        element.textContent = message;
    });
    return message;
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
    const patientsGrid = document.querySelector('.patients-grid');
    const lockMessageContainer = patientsGrid || doctorSection || instructionText;
    const lockMessageId = 'doctor-lock-message';
    let lockMessage = lockMessageContainer ? lockMessageContainer.querySelector(`#${lockMessageId}`) : null;
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

    const syncLockMessageCopy = newText => {
        return syncDoctorLockMessages(newText);
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
        lockMessage.textContent = getDoctorLockMessageText();
        lockMessageContainer.appendChild(lockMessage);
        syncLockMessageCopy(lockMessage.textContent);
    } else {
        syncLockMessageCopy();
    }

    if (!doctorUnlocked) {
        doctor.style.cursor = 'default';
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

        lockMessage.textContent = getDoctorLockMessageText();
        lockMessage.classList.add('visible');

        if (lockMessageTimeout) {
            clearTimeout(lockMessageTimeout);
        }

        lockMessageTimeout = setTimeout(() => {
            hideDoctorLockMessage();
        }, LOCK_MESSAGE_DURATION_MS);
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
        }, DOCTOR_UNLOCK_DELAY_MS);
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
            const card = image.closest('.patient-card');
            const hiddenByCard = card?.getAttribute('aria-hidden') === 'true';
            return !hiddenByCard && parseFloat(style.opacity) > 0 && style.visibility !== 'hidden';
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
    const recommendationToggle = modal.querySelector('.reconsider-switch-btn[data-patient="recommendation"]');
    const choiceToggle = modal.querySelector('.reconsider-switch-btn[data-patient="original"]');
    const recommendationBadge = modal.querySelector('.decision-card--recommendation .choice-badge');
    const choiceBadge = modal.querySelector('.decision-card[data-decision="keep"] .choice-badge');
    const i18nChoice = window.__i18n?.choice_experiment || {};
    const recommendationToggleText = i18nChoice.recommendation_toggle || i18nChoice.recommendation || 'Recommendation';
    const yourChoiceToggleText = i18nChoice.your_choice_toggle || i18nChoice.originally_selected || 'Your Choice';

    if (modal) {
        modal._seenPatientRoles = new Set();
        modal._decisionUnlockAt = null;
        if (modal._lockMessageTimeout) {
            clearTimeout(modal._lockMessageTimeout);
            modal._lockMessageTimeout = null;
        }
        if (modal._lockMessage) {
            modal._lockMessage.classList.remove('visible');
        }
    }

    if (recommendationToggle) {
        recommendationToggle.textContent = recommendationToggleText;
    }
    if (choiceToggle) {
        choiceToggle.textContent = yourChoiceToggleText;
    }

    const switcher = modal ? modal.querySelector('.reconsider-patient-switcher') : null;
    const swapRecommendationOrder = typeof data.swap_recommendation_order === 'boolean'
        ? data.swap_recommendation_order
        : Math.random() < 0.5;
    if (switcher) {
        switcher.classList.toggle('swap-order', swapRecommendationOrder);
    }

    const orderLabels = data.order_labels || {};
    const getOrderLabel = order => {
        if (order === 1 || order === '1') {
            return orderLabels[1] || orderLabels['1'] || '1st Patient';
        }
        if (order === 2 || order === '2') {
            return orderLabels[2] || orderLabels['2'] || '2nd Patient';
        }
        return '';
    };
    const getOrderWord = order => {
        if (order === 1 || order === '1') {
            return 'first';
        }
        if (order === 2 || order === '2') {
            return 'second';
        }
        return '';
    };

    const normalizePath = value => {
        if (!value) {
            return '';
        }
        const raw = value.split('?')[0];
        let clean = raw;
        try {
            clean = decodeURIComponent(raw);
        } catch (error) {
            clean = raw;
        }
        const resizedIndex = clean.indexOf('resized_images/');
        if (resizedIndex !== -1) {
            return clean.slice(resizedIndex);
        }
        return clean;
    };

    const getFilename = value => {
        if (!value) {
            return '';
        }
        const clean = value.split('?')[0];
        const parts = clean.split('/');
        return parts[parts.length - 1] || '';
    };

    const buildMatchKey = value => {
        if (!value) {
            return '';
        }
        const normalized = normalizePath(value).toLowerCase();
        return normalized.replace(/[^a-z0-9]/g, '');
    };

    const findChoiceCardByImage = imagePath => {
        const targetKey = buildMatchKey(imagePath);
        const targetFilenameKey = buildMatchKey(getFilename(imagePath));
        const cards = Array.from(document.querySelectorAll('.patients-grid > .patient-card'));

        for (const card of cards) {
            const img = card.querySelector('img.patient-image');
            if (!img) {
                continue;
            }

            const fullpath = img.dataset.fullpath || img.getAttribute('data-fullpath') || '';
            const filename = img.dataset.filename || img.getAttribute('data-filename') || img.getAttribute('src') || '';
            const fullpathKey = buildMatchKey(fullpath);
            const filenameKey = buildMatchKey(filename);

            if ((targetKey && fullpathKey && targetKey === fullpathKey)
                || (targetKey && filenameKey && targetKey === filenameKey)
                || (targetFilenameKey && filenameKey && targetFilenameKey === filenameKey)) {
                return { card, img };
            }
        }

        return null;
    };

    const computeTooltipFromFilename = (imagePath, orderWord) => {
        if (!imagePath || !orderWord) {
            return '';
        }
        const filename = getFilename(imagePath);
        if (!filename) {
            return '';
        }
        const stub = { dataset: { filename } };
        return buildHoverDescription(stub, orderWord);
    };

    const getTooltipFromChoiceCard = imagePath => {
        const match = findChoiceCardByImage(imagePath);
        if (!match) {
            return '';
        }
        const orderWord = match.card.dataset.patientIndex === '0' ? 'first' : 'second';
        const tooltipNode = match.card.querySelector('.info-dot-wrapper .hover-description');
        const existingTooltip = tooltipNode?.textContent?.trim();
        return existingTooltip
            || buildHoverDescription(match.img, orderWord)
            || match.img.dataset.description
            || match.img.alt
            || '';
    };

    const resolveOrderFromCards = imagePath => {
        const targetPath = normalizePath(imagePath);
        const targetFilename = getFilename(imagePath);
        const cards = Array.from(document.querySelectorAll('.patients-grid > .patient-card'));

        for (const card of cards) {
            const img = card.querySelector('img.patient-image');
            if (!img) {
                continue;
            }

            const fullpath = normalizePath(img.dataset.fullpath || img.getAttribute('data-fullpath') || '');
            const filename = getFilename(img.dataset.filename || img.getAttribute('data-filename') || img.getAttribute('src') || '');
            const matchesPath = targetPath && fullpath && targetPath === fullpath;
            const matchesFilename = targetFilename && filename && targetFilename === filename;

            if (matchesPath || matchesFilename) {
                if (card.dataset.patientIndex === '0') {
                    return 1;
                }
                if (card.dataset.patientIndex === '1') {
                    return 2;
                }
            }
        }

        return null;
    };

    let originalOrder = data.original_order ?? resolveOrderFromCards(data.original);
    let suggestionOrder = data.suggestion_order ?? resolveOrderFromCards(data.suggestion);
    if ((originalOrder == null || originalOrder === '') && (suggestionOrder === 1 || suggestionOrder === '1')) {
        originalOrder = 2;
    } else if ((originalOrder == null || originalOrder === '') && (suggestionOrder === 2 || suggestionOrder === '2')) {
        originalOrder = 1;
    }
    if ((suggestionOrder == null || suggestionOrder === '') && (originalOrder === 1 || originalOrder === '1')) {
        suggestionOrder = 2;
    } else if ((suggestionOrder == null || suggestionOrder === '') && (originalOrder === 2 || originalOrder === '2')) {
        suggestionOrder = 1;
    }
    const originalOrderWord = getOrderWord(originalOrder);
    const suggestionOrderWord = getOrderWord(suggestionOrder);
    let originalTooltip = getTooltipFromChoiceCard(data.original)
        || computeTooltipFromFilename(data.original, originalOrderWord)
        || data.original_desc
        || '';
    let suggestionTooltip = getTooltipFromChoiceCard(data.suggestion)
        || computeTooltipFromFilename(data.suggestion, suggestionOrderWord)
        || data.suggestion_desc
        || '';
   
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

    const applyModalDescription = (image, order, fallbackText) => {
        if (!image) {
            return;
        }
        const explicitTooltip = image.dataset.tooltip || '';
        if (explicitTooltip) {
            image.dataset.description = explicitTooltip;
            image.alt = explicitTooltip;
            return;
        }
        const fallback = typeof fallbackText === 'string' ? fallbackText.trim() : '';
        if (fallback) {
            image.dataset.description = fallback;
            image.alt = fallback;
        }
        const orderWord = getOrderWord(order);
        if (!orderWord) {
            return;
        }
        const computed = buildHoverDescription(image, orderWord);
        if (computed) {
            image.dataset.description = computed;
        }
    };

    const syncModalTooltips = () => {
        const tooltipEntries = [
            { image: originalChoice, tooltip: originalTooltip },
            { image: suggestedChoice, tooltip: suggestionTooltip },
            { image: dragOriginalChoice, tooltip: originalTooltip },
            { image: dragSuggestedChoice, tooltip: suggestionTooltip }
        ];

        tooltipEntries.forEach(({ image, tooltip }) => {
            if (!image || !tooltip) {
                return;
            }
            image.dataset.description = tooltip;
            image.dataset.tooltip = tooltip;
            image.alt = tooltip;
            const container = image.closest('.decision-visual') || image.parentElement;
            const tooltipNode = container?.querySelector('.info-dot-wrapper .hover-description');
            if (tooltipNode) {
                tooltipNode.textContent = getTooltipForContainer(container, tooltip);
            }
        });

        if (!modal) {
            return;
        }

        modal.querySelectorAll('.decision-visual').forEach(container => {
            const img = container.querySelector('img.patient-image');
            if (!img) {
                return;
            }
            const orderWord = img.dataset.orderWord || '';
            const tooltip = img.dataset.tooltip
                || img.dataset.description
                || buildHoverDescription(img, orderWord)
                || img.alt
                || '';
            if (!tooltip) {
                return;
            }
            const existingWrapper = container.querySelector('.info-dot-wrapper');
            if (existingWrapper) {
                const hover = existingWrapper.querySelector('.hover-description');
                if (hover) {
                    hover.textContent = getTooltipForContainer(container, tooltip);
                }
            } else {
                buildInfoDot(container, tooltip);
            }
        });
    };

    const setOrderWord = (image, order) => {
        if (!image) {
            return;
        }
        const orderWord = getOrderWord(order);
        if (orderWord) {
            image.dataset.orderWord = orderWord;
        } else {
            image.removeAttribute('data-order-word');
        }
    };

    setOrderWord(originalChoice, originalOrder);
    setOrderWord(suggestedChoice, suggestionOrder);
    setOrderWord(dragOriginalChoice, originalOrder);
    setOrderWord(dragSuggestedChoice, suggestionOrder);

    const computeModalTooltip = (image, order, fallbackText) => {
        if (!image) {
            return '';
        }
        const orderWord = getOrderWord(order) || image.dataset.orderWord || '';
        const filename = image.dataset.filename || image.getAttribute('data-filename') || '';
        const parsed = parsePatientFilename(filename);
        if (parsed && orderWord) {
            return buildHoverDescription(image, orderWord);
        }
        if (typeof fallbackText === 'string' && fallbackText.trim()) {
            return fallbackText.trim();
        }
        return image.dataset.description || image.alt || '';
    };

    originalTooltip = computeModalTooltip(originalChoice, originalOrder, originalTooltip);
    suggestionTooltip = computeModalTooltip(suggestedChoice, suggestionOrder, suggestionTooltip);

    if (originalDesc) {
        originalDesc.textContent = originalTooltip;
    }
    if (suggestedDesc) {
        suggestedDesc.textContent = suggestionTooltip;
    }
    originalChoice.dataset.description = originalTooltip;
    originalChoice.dataset.tooltip = originalTooltip;
    suggestedChoice.dataset.description = suggestionTooltip;
    suggestedChoice.dataset.tooltip = suggestionTooltip;
    if (dragOriginalDesc) {
        dragOriginalDesc.textContent = originalTooltip;
    }
    if (dragSuggestedDesc) {
        dragSuggestedDesc.textContent = suggestionTooltip;
    }
    if (dragOriginalChoice) {
        dragOriginalChoice.dataset.description = originalTooltip;
        dragOriginalChoice.dataset.tooltip = originalTooltip;
    }
    if (dragSuggestedChoice) {
        dragSuggestedChoice.dataset.description = suggestionTooltip;
        dragSuggestedChoice.dataset.tooltip = suggestionTooltip;
    }

    applyModalDescription(originalChoice, originalOrder, originalTooltip);
    applyModalDescription(suggestedChoice, suggestionOrder, suggestionTooltip);
    applyModalDescription(dragOriginalChoice, originalOrder, originalTooltip);
    applyModalDescription(dragSuggestedChoice, suggestionOrder, suggestionTooltip);
    modal.dataset.originalChoice = data.original;
    modal.dataset.suggestedChoice = data.suggestion;
    if (originalOrderWord) {
        modal.dataset.originalOrderWord = originalOrderWord;
    } else {
        modal.removeAttribute('data-original-order-word');
    }
    if (suggestionOrderWord) {
        modal.dataset.suggestionOrderWord = suggestionOrderWord;
    } else {
        modal.removeAttribute('data-suggestion-order-word');
    }

    if (recommendationBadge) {
        const label = getOrderLabel(suggestionOrder) || recommendationBadge.textContent;
        recommendationBadge.textContent = label;
    }

    if (choiceBadge) {
        const label = getOrderLabel(originalOrder) || choiceBadge.textContent;
        choiceBadge.textContent = label;
    }

    if (errorMessage) {
        errorMessage.textContent = '';
        errorMessage.classList.remove('visible');
    }

    const decisionCards = modal.querySelectorAll('.decision-card');
    decisionCards.forEach(card => {
        card.disabled = false;
        card.classList.remove('decision-card--selected');
        card.onclick = () => {
            if (modal && typeof modal._canAttemptDecision === 'function' && !modal._canAttemptDecision()) {
                return;
            }
            finalizeReconsider(card.dataset.decision);
        };
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
    syncModalTooltips();
    setTimeout(syncModalTooltips, 0);
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

const SEVERITY_WORDING = {
    '1': 'healthy',
    '2': 'mildly sick',
    '3': 'sick',
    '4': 'seriously sick'
};

const AGE_GENDER_WORDING = {
    oldman: 'old man',
    man: 'man',
    boy: 'boy',
    oldwoman: 'old woman',
    woman: 'woman',
    girl: 'girl',
    pregnantwoman: 'pregnant woman',
    pregnant: 'pregnant woman',
    child: 'child'
};

const MEDICATION_WORDING = {
    '1': '1 injection',
    '2': '2 injections',
    '3': '3 injections'
};

function parsePatientFilename(filename) {
    if (!filename) {
        return null;
    }

    const stem = filename
        .replace(/\.[^.]+$/, '')
        .replace(/(\s|_)+copy\d*$/i, '')
        .toLowerCase();

    // Remove separators for a tight match (handles underscores/spaces/hyphens)
    const compact = stem.replace(/[\s_-]+/g, '').replace(/copy\d*$/i, '');

    const AGE_GENDER_KEYS = Object.keys(AGE_GENDER_WORDING).sort((a, b) => b.length - a.length);
    const ageGenderPattern = AGE_GENDER_KEYS.join('|');

    // Pattern with separators (spaces/underscores) allowed
    const spacedPattern = new RegExp(
        `^(?<age_gender>${ageGenderPattern})\\s*[_-]?\\s*(?<state_before>[1-4])\\s*after\\s*(?<age_gender_after>${ageGenderPattern})\\s*[_-]?\\s*(?<state_after>[1-4])\\s*[_-]?\\s*pill\\s*(?<med>[1-3])`,
        'i'
    );

    // Compact pattern (no separators)
    const compactPattern = new RegExp(
        `^(?<age_gender>${ageGenderPattern})(?<state_before>[1-4])after(?<age_gender_after>${ageGenderPattern})(?<state_after>[1-4])pill(?<med>[1-3])`,
        'i'
    );

    const runMatch = (pattern, value) => {
        const match = value.match(pattern);
        if (!match || !match.groups) {
            return null;
        }
        if (match.groups.age_gender !== match.groups.age_gender_after) {
            return null;
        }
        return {
            ageGender: match.groups.age_gender.toLowerCase(),
            stateBefore: match.groups.state_before,
            stateAfter: match.groups.state_after,
            medication: match.groups.med
        };
    };

    return runMatch(spacedPattern, stem) || runMatch(compactPattern, compact);
}

function humanizeAgeGender(token) {
    if (!token) {
        return '';
    }
    if (AGE_GENDER_WORDING[token]) {
        return AGE_GENDER_WORDING[token];
    }
    return token.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function buildHoverDescription(img, orderWord) {
    if (!orderWord) {
        return img.dataset?.description || img.alt || '';
    }

    const filename = img.dataset?.filename || img.getAttribute('data-filename') || '';
    const parsed = parsePatientFilename(filename);
    if (!parsed) {
        return img.dataset?.description || img.alt || '';
    }

    const severityBefore = SEVERITY_WORDING[parsed.stateBefore] || parsed.stateBefore;
    const severityAfter = SEVERITY_WORDING[parsed.stateAfter] || parsed.stateAfter;
    const ageGender = humanizeAgeGender(parsed.ageGender);
    const medication = MEDICATION_WORDING[parsed.medication] || `${parsed.medication} injections`;
    const orderText = orderWord || '';

    return `The patient appears ${orderText}. The patient is a ${severityBefore} ${ageGender}. After treatment with ${medication}, the patient will be ${severityAfter}.`;
}

function getTooltipForContainer(container, fallback = '') {
    if (!container) {
        return fallback;
    }
    const img = container.querySelector('img.patient-image');
    if (!img) {
        return fallback;
    }

    const normalizeTooltip = value => (value || '').trim();
    const isPlaceholder = value => {
        const normalized = normalizeTooltip(value).toLowerCase();
        return normalized === 'recommended patient from the model'
            || normalized === 'your original patient choice';
    };

    let orderWord = img.dataset.orderWord || '';
    if (!orderWord) {
        const patientCard = container.closest('.patient-card');
        if (patientCard) {
            orderWord = patientCard.dataset.patientIndex === '0' ? 'first' : 'second';
        }
    }
    if (!orderWord) {
        const card = container.closest('[data-patient-role]');
        const badgeText = card?.querySelector('.choice-badge')?.textContent || '';
        if (badgeText.includes('1')) {
            orderWord = 'first';
        } else if (badgeText.includes('2')) {
            orderWord = 'second';
        }
        const modal = container.closest('#reconsider-modal');
        if (modal && card?.dataset.patientRole) {
            if (card.dataset.patientRole === 'original' && modal.dataset.originalOrderWord) {
                orderWord = modal.dataset.originalOrderWord;
            }
            if (card.dataset.patientRole === 'recommendation' && modal.dataset.suggestionOrderWord) {
                orderWord = modal.dataset.suggestionOrderWord;
            }
        }
    }

    const currentTooltip = normalizeTooltip(img.dataset.tooltip)
        || normalizeTooltip(img.dataset.description)
        || normalizeTooltip(img.alt);
    const computedTooltip = normalizeTooltip(buildHoverDescription(img, orderWord));
    const fallbackTooltip = normalizeTooltip(fallback);
    const candidates = [computedTooltip, currentTooltip, fallbackTooltip].filter(Boolean);
    const nonPlaceholder = candidates.filter(text => !isPlaceholder(text));
    const finalTooltip = (nonPlaceholder.length ? nonPlaceholder : candidates)
        .sort((a, b) => b.length - a.length)[0] || fallbackTooltip;

    if (finalTooltip) {
        img.dataset.tooltip = finalTooltip;
        img.dataset.description = finalTooltip;
        img.alt = finalTooltip;
    }

    return finalTooltip || fallback;
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
            tooltip.textContent = getTooltipForContainer(container, description);
        }
        if (button) {
            button.setAttribute('aria-label', label);
        }
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'info-dot-wrapper';

    const isNestedButton = Boolean(container.closest('button'));
    const button = document.createElement(isNestedButton ? 'span' : 'button');
    if (!isNestedButton) {
        button.type = 'button';
    } else {
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
    }
    button.className = 'info-dot';
    button.setAttribute('aria-label', label);
    button.textContent = '?';
    button.setAttribute('aria-expanded', 'false');

    const tooltip = document.createElement('span');
    tooltip.className = 'hover-description';
    tooltip.textContent = getTooltipForContainer(container, description);

    wrapper.appendChild(button);
    wrapper.appendChild(tooltip);
    container.appendChild(wrapper);

    const updateTooltip = () => {
        const latest = getTooltipForContainer(container, tooltip.textContent || description);
        if (latest) {
            tooltip.textContent = latest;
        }
    };
    const show = () => {
        updateTooltip();
        wrapper.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
    };
    const hide = () => {
        wrapper.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
    };
    const toggle = () => {
        if (wrapper.classList.contains('is-open')) {
            hide();
        } else {
            updateTooltip();
            show();
        }
    };
    const stopEvent = event => {
        event.stopPropagation();
        event.preventDefault();
    };
    const supportsHover = window.matchMedia ? window.matchMedia('(hover: hover)').matches : true;
    let ignoreFocus = false;
    const markPointer = () => {
        ignoreFocus = true;
    };
    const handleFocus = () => {
        if (ignoreFocus) {
            ignoreFocus = false;
            return;
        }
        show();
    };
    const handleBlur = () => {
        ignoreFocus = false;
        hide();
    };

    button.addEventListener('pointerdown', markPointer);
    button.addEventListener('mousedown', markPointer);
    button.addEventListener('touchstart', markPointer);
    if (supportsHover) {
        button.addEventListener('mouseenter', show);
        button.addEventListener('mouseleave', hide);
        wrapper.addEventListener('mouseleave', hide);
    }
    button.addEventListener('focus', handleFocus);
    button.addEventListener('blur', handleBlur);
    button.addEventListener('click', event => {
        stopEvent(event);
        ignoreFocus = false;
        toggle();
    });
    button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            stopEvent(event);
            toggle();
        }
    });
}

function attachPatientTooltips(root = document) {
    const containers = root.querySelectorAll('.image-container, .decision-visual');
    containers.forEach(container => {
        const img = container.querySelector('img.patient-image');
        if (!img) {
            return;
        }
        const patientCard = container.closest('.patient-card');
        let orderWord = '';
        if (img.dataset.orderWord) {
            orderWord = img.dataset.orderWord;
        } else if (patientCard) {
            orderWord = patientCard.dataset.patientIndex === '0' ? 'first' : 'second';
        } else if (img.dataset.patientOrder === '1' || img.dataset.order === '1') {
            orderWord = 'first';
        } else if (img.dataset.patientOrder === '2' || img.dataset.order === '2') {
            orderWord = 'second';
        }
        const explicitTooltip = img.dataset.tooltip || img.dataset.tooltipText || '';
        const description = explicitTooltip || buildHoverDescription(img, orderWord) || img.dataset.description || img.alt || '';
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

    const canAttemptDecision = () => {
        if (typeof modal._canAttemptDecision === 'function') {
            return modal._canAttemptDecision();
        }
        return true;
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

        if (!canAttemptDecision()) {
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

        if (!canAttemptDecision()) {
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
    const requiredRoles = new Set(cards.map(card => card.dataset.patientRole).filter(Boolean));
    const seenRoles = modal._seenPatientRoles instanceof Set ? modal._seenPatientRoles : new Set();
    modal._seenPatientRoles = seenRoles;

    const stage = modal.querySelector('.interactive-stage');
    const recommendationCard = stage?.querySelector('[data-patient-role="recommendation"]') || null;
    const originalCard = stage?.querySelector('[data-patient-role="original"]') || null;
    const doctorColumn = stage?.querySelector('.doctor-drag-column') || null;
    const lockMessageHost = modal.querySelector('.reconsider-panels') || modal.querySelector('.reconsider-panel') || modal;
    let lockMessage = modal._lockMessage || modal.querySelector('.doctor-lock-message');
    let lockMessageTimeout = modal._lockMessageTimeout || null;
    if (!lockMessage && lockMessageHost) {
        lockMessage = document.createElement('div');
        lockMessage.className = 'doctor-lock-message';
        lockMessage.setAttribute('role', 'status');
        lockMessage.setAttribute('aria-live', 'polite');
        lockMessage.textContent = getDoctorLockMessageText();
        lockMessageHost.appendChild(lockMessage);
        modal._lockMessage = lockMessage;
    }

    const clearLockMessageTimeout = () => {
        if (lockMessageTimeout) {
            clearTimeout(lockMessageTimeout);
            lockMessageTimeout = null;
            modal._lockMessageTimeout = null;
        }
    };

    const hideLockMessage = () => {
        if (!lockMessage) {
            return;
        }
        lockMessage.classList.remove('visible');
        clearLockMessageTimeout();
    };

    const showLockMessage = () => {
        if (!lockMessage) {
            return;
        }
        lockMessage.textContent = getDoctorLockMessageText();
        lockMessage.classList.add('visible');
        clearLockMessageTimeout();
        lockMessageTimeout = setTimeout(() => {
            hideLockMessage();
        }, LOCK_MESSAGE_DURATION_MS);
        modal._lockMessageTimeout = lockMessageTimeout;
    };

    const updateDoctorTargets = () => {
        if (doctor && doctor._modalDragController) {
            const activeTargets = modal.querySelectorAll('.drag-target--target.is-active');
            const fallbackTargets = modal.querySelectorAll('.drag-target--target');
            doctor._modalDragController.updateTargets(activeTargets.length ? activeTargets : fallbackTargets);
        }
    };

    const hasSeenAllRoles = () => {
        if (requiredRoles.size === 0) {
            return true;
        }
        for (const role of requiredRoles) {
            if (!seenRoles.has(role)) {
                return false;
            }
        }
        return true;
    };

    const isDecisionReady = () => {
        if (!hasSeenAllRoles()) {
            return false;
        }
        const unlockAt = modal._decisionUnlockAt;
        return typeof unlockAt === 'number' && Date.now() >= unlockAt;
    };

    const canAttemptDecision = () => {
        if (!hasSeenAllRoles()) {
            showLockMessage();
            return false;
        }
        if (!isDecisionReady()) {
            showLockMessage();
            return false;
        }
        hideLockMessage();
        return true;
    };

    const setActivePatient = key => {
        if (key) {
            seenRoles.add(key);
        }
        const canSelect = hasSeenAllRoles();
        if (canSelect && modal._decisionUnlockAt == null) {
            modal._decisionUnlockAt = Date.now() + DOCTOR_UNLOCK_DELAY_MS;
        }
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
        hideLockMessage();
    };

    // Allow other initializers to reuse the setter without duplicating listeners
    modal._setActivePatient = setActivePatient;
    modal._canAttemptDecision = canAttemptDecision;
    modal._hideDecisionLockMessage = hideLockMessage;

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
