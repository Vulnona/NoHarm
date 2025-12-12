document.addEventListener('DOMContentLoaded', function () {
    const languageSwitcher = document.getElementById('language-switcher');
    const currentPage = document.body.getAttribute('data-page'); // Detect the current page
    if (!languageSwitcher) {
        return;
    }

    const supportedLanguages = Array.from(languageSwitcher.options, option => option.value);

    // Detect user language or load saved language from localStorage
    const defaultLanguage = navigator.language ? navigator.language.slice(0, 2) : 'en'; // E.g., 'en', 'fr'
    let savedLanguage = localStorage.getItem('selectedLanguage') || defaultLanguage || 'en';
    if (!supportedLanguages.includes(savedLanguage)) {
        savedLanguage = 'en';
    }

    // Set and apply selected language on page load
    changeLanguage(savedLanguage);
    languageSwitcher.value = savedLanguage;

    // Change language event listener
    languageSwitcher.addEventListener('change', function () {
        const selectedLanguage = this.value;
        localStorage.setItem('selectedLanguage', selectedLanguage); // Save the selected language
        changeLanguage(selectedLanguage);
    });

    function persistLanguage(language) {
        fetch('/change-language', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ language })
        }).catch(error => {
            console.error('Failed to persist language preference', error);
        });
    }

    function loadLanguageData(language) {
        return fetch(`/translations/${language}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load translations for ${language}`);
                }
                return response.json();
            });
    }

    function handleTranslationError(error) {
        console.error('Failed to load translations', error);
    }

    // Function to dynamically change language
    function changeLanguage(language) {
        // Set RTL for Arabic and Urdu
        document.documentElement.dir = ['ar', 'ur'].includes(language) ? 'rtl' : 'ltr';
        document.documentElement.lang = language;

        persistLanguage(language);

        loadLanguageData(language)
            .then(data => {
                window.__i18n = data;
                console.log("Current page is:", currentPage);
                let ageErrorMessage = null;
                if (currentPage === "admin_login") {
                    // For admin_login.html
                    document.querySelector('h1').textContent = data.admin_login.title;
                    document.querySelector('label[for="password"]').textContent = data.admin_login.password_label;
                    document.querySelector('input[type="submit"]').value = data.admin_login.login_button;
                } else if (currentPage === "intro") {
                    // For intro.html
                    document.getElementById('intro-title').textContent = data.intro.intro_title;
                    document.getElementById('intro-paragraph-1').innerHTML = data.intro.intro_paragraph_1;
                    document.getElementById('intro-paragraph-2').innerHTML = data.intro.intro_paragraph_2;
                    // Update signature section if it exists
                    const signatureElement = document.querySelector('.signature');
                    if (signatureElement && data.intro.signature) {
                        signatureElement.innerHTML = data.intro.signature;
                    }

                    document.getElementById('consent-title').textContent = data.intro.consent_title;
                    document.getElementById('consent-message').textContent = data.intro.consent_message;
                    document.getElementById('yes-label-span').textContent = data.intro.yes_label;
                    document.getElementById('no-label-span').textContent = data.intro.no_label;
                    const startBtn = document.getElementById('start-btn');
                    if (startBtn) {
                        startBtn.textContent = data.intro.start_button;
                    }
                    document.getElementById('callout-1').textContent = data.intro["callout-1"];
                    document.getElementById('callout-2').textContent = data.intro["callout-2"];
                    document.getElementById('callout-3').textContent = data.intro["callout-3"];
                    document.getElementById('yes-desc').textContent = data.intro["yes-desc"];
                    document.getElementById('no-desc').textContent = data.intro["no-desc"];



                    initConsentLogic(data.intro);
                } else if (currentPage === "choice_experiment") {
                    // For choice_experiment.html
                    const instructionContainer = document.querySelector('.instruction-text');
                    if (instructionContainer) {
                        const instructionParagraph = instructionContainer.querySelector('p');
                        if (instructionParagraph) {
                            instructionParagraph.textContent = data.choice_experiment.instruction_text;
                        }
                        if (data.choice_experiment.doctor_lock_message && window.updateDoctorLockMessageText) {
                            window.updateDoctorLockMessageText(data.choice_experiment.doctor_lock_message);
                        }
                    }

                    const patientLabels = document.querySelectorAll('.patient-label');
                    if (patientLabels[0]) {
                        patientLabels[0].textContent = data.choice_experiment.patient_label_1;
                    }
                    if (patientLabels[1]) {
                        patientLabels[1].textContent = data.choice_experiment.patient_label_2;
                    }

                    const doctorInstruction = document.querySelector('.doctor-instruction');
                    if (doctorInstruction) {
                        doctorInstruction.textContent = data.choice_experiment.doctor_instruction;
                    }

                    document.querySelector('.highlight-text').textContent = data.choice_experiment.reconsider_message;
                    document.querySelector('.decision-text').textContent = data.choice_experiment.decision_text;

                    const selectionLabels = document.querySelectorAll('.selection-label');
                    if (selectionLabels[0]) {
                        selectionLabels[0].textContent = data.choice_experiment.originally_selected;
                    }
                    if (selectionLabels[1]) {
                        selectionLabels[1].textContent = data.choice_experiment.recommendation;
                    }

                    const modal = document.getElementById('reconsider-modal');
                    if (modal && data.choice_experiment) {
                        const highlight = modal.querySelector('.highlight-text');
                        if (highlight && data.choice_experiment.reconsider_message) {
                            highlight.textContent = data.choice_experiment.reconsider_message;
                        }

                        const subtitle = modal.querySelector('.decision-text');
                        if (subtitle && data.choice_experiment.decision_text) {
                            subtitle.textContent = data.choice_experiment.decision_text;
                        }

                        const toggleButtons = modal.querySelectorAll('.reconsider-view-btn');
                        toggleButtons.forEach(button => {
                            if (button.dataset.view === 'overview' && data.choice_experiment.reconsider_overview_toggle) {
                                button.textContent = data.choice_experiment.reconsider_overview_toggle;
                            }
                            if (button.dataset.view === 'interactive' && data.choice_experiment.reconsider_interactive_toggle) {
                                button.textContent = data.choice_experiment.reconsider_interactive_toggle;
                            }
                        });

                        const keepCards = modal.querySelectorAll('.decision-card[data-decision="keep"]');
                        keepCards.forEach(keepCard => {
                            const badge = keepCard.querySelector('.choice-badge');
                            if (badge && data.choice_experiment.originally_selected) {
                                badge.textContent = data.choice_experiment.originally_selected;
                            }

                            const action = keepCard.querySelector('.choice-action');
                            if (action && data.choice_experiment.keep_original_button) {
                                action.textContent = data.choice_experiment.keep_original_button;
                            }

                            const accessibleLabel = data.choice_experiment.keep_original_accessible || data.choice_experiment.keep_original_button;
                            if (accessibleLabel) {
                                keepCard.setAttribute('aria-label', accessibleLabel);
                            }
                        });

                        const switchCards = modal.querySelectorAll('.decision-card[data-decision="switch"]');
                        switchCards.forEach(switchCard => {
                            const badge = switchCard.querySelector('.choice-badge');
                            if (badge && data.choice_experiment.recommendation) {
                                badge.textContent = data.choice_experiment.recommendation;
                            }

                            const action = switchCard.querySelector('.choice-action');
                            if (action && data.choice_experiment.switch_recommendation_button) {
                                action.textContent = data.choice_experiment.switch_recommendation_button;
                            }

                            const accessibleLabel = data.choice_experiment.switch_recommendation_accessible || data.choice_experiment.switch_recommendation_button;
                            if (accessibleLabel) {
                                switchCard.setAttribute('aria-label', accessibleLabel);
                            }
                        });

                        const patientSwitchButtons = modal.querySelectorAll('.reconsider-switch-btn');
                        patientSwitchButtons.forEach(btn => {
                            if (btn.dataset.patient === 'recommendation' && data.choice_experiment.patient_label_1) {
                                btn.textContent = data.choice_experiment.patient_label_1;
                            }
                            if (btn.dataset.patient === 'original' && data.choice_experiment.patient_label_2) {
                                btn.textContent = data.choice_experiment.patient_label_2;
                            }
                        });

                        const optionsGroup = modal.querySelector('.reconsider-options, .reconsider-cards');
                        if (optionsGroup && data.choice_experiment.reconsider_group_label) {
                            optionsGroup.setAttribute('aria-label', data.choice_experiment.reconsider_group_label);
                        }

                        const dragHint = modal.querySelector('.interactive-hint');
                        if (dragHint && data.choice_experiment.reconsider_drag_hint) {
                            dragHint.textContent = data.choice_experiment.reconsider_drag_hint;
                        }

                        const doctorHint = modal.querySelector('.doctor-drop-hint');
                        if (doctorHint && data.choice_experiment.reconsider_drag_doctor_hint) {
                            doctorHint.textContent = data.choice_experiment.reconsider_drag_doctor_hint;
                        }
                    }

                    const mobileSwitcher = document.getElementById('mobile-patient-switcher');
                    if (mobileSwitcher) {
                        if (data.choice_experiment.patient_toggle_label) {
                            mobileSwitcher.setAttribute('aria-label', data.choice_experiment.patient_toggle_label);
                        }
                        const switchButtons = mobileSwitcher.querySelectorAll('.mobile-switch-btn');
                        if (switchButtons[0]) {
                            switchButtons[0].textContent = data.choice_experiment.patient_label_1;
                        }
                        if (switchButtons[1]) {
                            switchButtons[1].textContent = data.choice_experiment.patient_label_2;
                        }
                    }

                    // Update image descriptions if they exist
                    updateImageDescriptions(data);
                } else if (currentPage === "demography") {

                    // For demography.html
                    document.querySelector('title').textContent = data.demography.title;

                    // Get the current question ID from the hidden input
                    const currentQuestionId = document.querySelector('input[name="question_id"]').value;

                    // Translate the question label regardless of content
                    document.querySelector('.question-block label').textContent = data.demography[`${currentQuestionId}_question`];

                    // Buttons
                    const prevBtn = document.querySelector('.prev-btn');
                    const nextBtn = document.querySelector('.next-btn');
                    if (prevBtn) prevBtn.textContent = data.demography.previous_button || "Previous";
                    if (nextBtn) nextBtn.textContent = data.demography.next_button || "Next";

                    const introBanner = document.getElementById('demography-intro');
                    if (introBanner && data.instructions?.title) {
                        introBanner.textContent = data.instructions.title;
                    }

                    const ageErrorElement = document.getElementById("age-error-msg");
                    if (ageErrorElement && data.demography.age_invalid) {
                        // ✅ Attach translation to data-error-text attribute
                        ageErrorElement.dataset.errorText = data.demography.age_invalid;
                        if (ageErrorElement.textContent.trim().length > 0) {
                            ageErrorElement.textContent = data.demography.age_invalid;
                            ageErrorElement.style.display = "block";
                        }
                    }

                    window.__i18n = window.__i18n || {};
                    window.__i18n.ageInvalid = data.demography.age_invalid;

                    // Handle different question types
                    if (currentQuestionId === "gender") {
                        // Get all label elements and match by their for attribute
                        document.querySelectorAll('label[for]').forEach(label => {
                            const forAttr = label.getAttribute('for');

                            if (forAttr === 'female') label.textContent = data.demography.female_label;
                            if (forAttr === 'male') label.textContent = data.demography.male_label;
                            if (forAttr === 'diverse') label.textContent = data.demography.diverse_label;
                            if (forAttr === 'prefer_not_to_disclose') label.textContent = data.demography.prefer_not_to_disclose_label;
                        });
                    } else if (currentQuestionId === "age") {

                        document.querySelector('input[placeholder]').placeholder = data.demography.age_placeholder;
                    } else if (currentQuestionId === "religion") {
                        // Get all label elements and match by their for attribute
                        document.querySelectorAll('label[for]').forEach(label => {
                            const forAttr = label.getAttribute('for');

                            if (forAttr === 'none') label.textContent = data.demography.no_religion;
                            if (forAttr === 'christian') label.textContent = data.demography.christian_label;
                            if (forAttr === 'islam') label.textContent = data.demography.islam_label;
                            if (forAttr === 'hinduism') label.textContent = data.demography.hinduism_label;
                            if (forAttr === 'buddhism') label.textContent = data.demography.buddhism_label;
                            if (forAttr === 'other') label.textContent = data.demography.other_label;
                        });
                    }

                }
                else if (currentPage === "instructions") {
                    // For instructions.html
                    document.querySelector('h1').textContent = data.instructions.title;
                    document.querySelector('.submit-btn').textContent = data.instructions.continue_button;
                } else if (currentPage === "group_preferences") {
                    // For group_preference.html
                    const questionId = document.querySelector('input[name="question_id"]').value;
                    // ✅ Add translations for navigation buttons
                    const prevBtn = document.querySelector('.prev-btn');
                    const nextBtn = document.querySelector('.next-btn');
                    if (prevBtn && data.group_preferences.previous_button) {
                        prevBtn.textContent = data.group_preferences.previous_button;
                    }
                    if (nextBtn) {
                        const isLast = questionId === 'children';
                        if (isLast && data.group_preferences.submit_button) {
                            nextBtn.textContent = data.group_preferences.submit_button;
                        } else if (data.group_preferences.next_button) {
                            nextBtn.textContent = data.group_preferences.next_button;
                        }
                    }
                    if (questionId === 'general_health') {
                        document.querySelector('.health-question-label').textContent = data.group_preferences.general_health_question;
                        document.querySelector('.health-scale-labels span:first-child').textContent = data.group_preferences.very_poor;
                        document.querySelector('.health-scale-labels span:last-child').textContent = data.group_preferences.excellent;
                    } else if (questionId === 'illness') {
                        document.querySelector('.question-label').textContent = data.group_preferences.illness_question;
                        document.querySelectorAll('.radio-label')[0].textContent = data.group_preferences.illness_yes;
                        document.querySelectorAll('.radio-label')[1].textContent = data.group_preferences.illness_no;
                    } else if (questionId === 'children') {
                        document.querySelector('.question-label').textContent = data.group_preferences.children_question;
                        document.querySelectorAll('.radio-label')[0].textContent = data.group_preferences.children_yes;
                        document.querySelectorAll('.radio-label')[1].textContent = data.group_preferences.children_no;
                    }
                } else if (currentPage === "procedural_ratings") {
                    const proceduralData = data.procedural_ratings || {};

                    const introEl = document.querySelector('.rating-intro');
                    if (introEl && proceduralData.rating_intro) {
                        introEl.textContent = proceduralData.rating_intro;
                    }

                    const prevBtn = document.querySelector('.prev-btn');
                    if (prevBtn && proceduralData.previous_button) {
                        prevBtn.textContent = proceduralData.previous_button;
                    }

                    const submitBtn = document.querySelector('.next-btn');
                    if (submitBtn) {
                        const label = proceduralData.next_button || proceduralData.submit_button;
                        if (label) {
                            submitBtn.textContent = label;
                        }
                    }

                    const startCaption = document.querySelector('.scale-caption-start');
                    if (startCaption && proceduralData.not_fair) {
                        startCaption.textContent = proceduralData.not_fair;
                    }

                    const endCaption = document.querySelector('.scale-caption-end');
                    if (endCaption && proceduralData.very_fair) {
                        endCaption.textContent = proceduralData.very_fair;
                    }

                    if (proceduralData.not_fair) {
                        document.querySelectorAll('.mobile-scale-caption-start').forEach(el => {
                            el.textContent = proceduralData.not_fair;
                        });
                    }

                    if (proceduralData.very_fair) {
                        document.querySelectorAll('.mobile-scale-caption-end').forEach(el => {
                            el.textContent = proceduralData.very_fair;
                        });
                    }

                    if (proceduralData.numbers) {
                        document.querySelectorAll('[data-scale-value]').forEach(element => {
                            const key = element.getAttribute('data-scale-value');
                            if (key && proceduralData.numbers[key]) {
                                element.textContent = proceduralData.numbers[key];
                            }
                        });
                    }

                    const progressEl = document.querySelector('.matrix-progress');
                    if (progressEl) {
                        if (proceduralData.progress_template) {
                            progressEl.dataset.template = proceduralData.progress_template;
                        }
                        if (typeof window.updateProceduralProgress === 'function') {
                            window.updateProceduralProgress();
                        }
                    }

                    if (Array.isArray(proceduralData.questions)) {
                        const lookup = new Map(proceduralData.questions.map(q => [q.id, q]));
                        document.querySelectorAll('.matrix-row.matrix-body').forEach(row => {
                            const questionId = row.getAttribute('data-question-id');
                            if (!questionId || !lookup.has(questionId)) {
                                return;
                            }
                            const question = lookup.get(questionId);
                            const labelEl = row.querySelector('[data-question-label]');
                            if (labelEl && question.label) {
                                labelEl.textContent = question.label;
                            }
                            const descEl = row.querySelector('[data-question-description]');
                            if (descEl) {
                                const fullText = question.full_text || '';
                                const prefix = question.label ? `${question.label}: ` : '';
                                if (fullText && prefix && fullText.startsWith(prefix)) {
                                    descEl.textContent = fullText.slice(prefix.length);
                                } else {
                                    descEl.textContent = fullText;
                                }
                            }
                        });
                    }

                } else if (currentPage === "thank_you") {
                    // For thank_you.html
                    document.getElementById('thank-you-title').textContent = data.thank_you.thank_you_title;
                    document.getElementById('thank-you-message').textContent = data.thank_you.thank_you_message;
                } else if (currentPage === "no_consent") {
                    // For no_consent.html
                    document.getElementById('no-consent-title').textContent = data.no_consent.no_consent_title;
                    document.getElementById('no-consent-message').textContent = data.no_consent.no_consent_message;
                }
            })
            .catch(handleTranslationError);
    }

    // Function to update image descriptions based on filename
    function updateImageDescriptions(data) {
        if (!data.images) return;

        // Find all images with data-filename attributes
        document.querySelectorAll('img[data-filename]').forEach(img => {
            const filename = img.dataset.filename;
            if (data.images[filename]) {
                // Update alt text and aria-label
                img.alt = data.images[filename];
                img.setAttribute('aria-label', data.images[filename]);

                // If there's a caption or description element after the image, update that too
                const nextEl = img.nextElementSibling;
                if (nextEl && (nextEl.classList.contains('image-caption') ||
                    nextEl.classList.contains('image-description') ||
                    nextEl.classList.contains('hover-description'))) {
                    nextEl.textContent = data.images[filename];
                }
            }
        });

        // Handle specific patient descriptions in choice experiment
        const patientDescriptions = {
            'patient_1_overweight': 'Overweight_simpler.png',
            'patient_2_disability': 'Disability.png',
            'patient_1_child': 'child_simple.png',
            'patient_2_elderly_couple': 'old_male_female_simpler.png',
            'patient_1_young_adult': 'Patient_with_Arm_Sling.png',
            'patient_2_senior_ill': 'Patient_with_IV_Drip.png'
        };

        // Update patient descriptions if they exist
        for (const [id, filename] of Object.entries(patientDescriptions)) {
            const element = document.getElementById(`${id}-label`);
            if (element && data.images[filename]) {
                element.textContent = data.images[filename];
            }
        }
    }



    // Function to update rating questions
    function updateRatingQuestions(questions) {
        // Find all question elements by their IDs and update them
        questions.forEach(question => {
            // Update question label
            const labelElement = document.querySelector(`label[for="${question.id}"]`);
            if (labelElement) {
                labelElement.textContent = question.label;
            }

            // Update full text description if visible
            const fullTextElement = document.getElementById(`${question.id}-full-text`);
            if (fullTextElement) {
                fullTextElement.textContent = question.full_text;
            }

            // Update tooltips or other elements that might contain the question text
            const tooltipElement = document.querySelector(`.tooltip[data-question="${question.id}"]`);
            if (tooltipElement) {
                tooltipElement.setAttribute('title', question.full_text);
                // If using a tooltip library, might need to reinitialize
                if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
                    new bootstrap.Tooltip(tooltipElement);
                }
            }
        });
    }

    function initConsentLogic(texts) {
        const radios = document.querySelectorAll('input[name="consent"]');
        const btn = document.getElementById('start-btn');
        const form = document.querySelector('.consent-form');
        const live = document.getElementById('consent-live');
        console.log("Found radios:", radios.length);


        function updateConsentButton() {
            // Button might not exist anymore (auto-submit mode)
            if (!btn) return;
            const chosen = document.querySelector('input[name="consent"]:checked');
            if (!chosen) {
                btn.disabled = true;
                btn.textContent = texts.start_button || 'Choose an option to continue';
                if (live) live.textContent = '';
                return;
            }
            btn.disabled = false;
            if (chosen.value === 'yes') {
                btn.textContent = texts.agree_button || 'Agree and continue';
                if (live) live.textContent = 'Agree and continue selected.';
            } else {
                btn.textContent = texts.disagree_button || 'Do not consent, finish survey';
                if (live) live.textContent = 'Do not consent selected. Survey will end.';
            }
        }

        function autoSubmit(evt) {
            const input = evt.target;
            if (!input || !form) return;
            // small timeout to allow label click animation (if any)
            setTimeout(() => {
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.submit();
                }
            }, 25);
        }

        radios.forEach(r => {
            r.addEventListener('change', updateConsentButton);
            r.addEventListener('change', autoSubmit);
        });
        updateConsentButton();
    }





});

// Add this outside the DOMContentLoaded event handler
window.updateModalTranslations = function () {
    const currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
        loadLanguageData(currentLanguage)
            .then(data => {
            // Update modal images
            const images = document.querySelectorAll('#reconsider-modal img[data-filename]');
            images.forEach(img => {
                const filename = img.dataset.filename;
                if (data.images && data.images[filename]) {
                    img.alt = data.images[filename];

                    // Find description element
                    const descId = img.id + '-description';
                    const descEl = document.getElementById(descId);
                    if (descEl) {
                        descEl.textContent = data.images[filename];
                    }
                }
            });
        })
        .catch(handleTranslationError);
};
