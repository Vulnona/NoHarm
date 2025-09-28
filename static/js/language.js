document.addEventListener('DOMContentLoaded', function () {
    const languageSwitcher = document.getElementById('language-switcher');
    const currentPage = document.body.getAttribute('data-page'); // Detect the current page

    // Detect user language or load saved language from localStorage
    const defaultLanguage = navigator.language.slice(0, 2); // E.g., 'en', 'fr'
    const savedLanguage = localStorage.getItem('selectedLanguage') || defaultLanguage || 'en';

    // Set and apply selected language on page load
    changeLanguage(savedLanguage);
    languageSwitcher.value = savedLanguage;

    // Change language event listener
    languageSwitcher.addEventListener('change', function () {
        const selectedLanguage = this.value;
        localStorage.setItem('selectedLanguage', selectedLanguage); // Save the selected language
        changeLanguage(selectedLanguage);
    });

    // Function to dynamically change language
    function changeLanguage(language) {
        // Set RTL for Arabic and Urdu
        document.documentElement.dir = ['ar', 'ur'].includes(language) ? 'rtl' : 'ltr';

        fetch(`/static/lang/${language}.json`)
            .then(response => response.json())
            .then(data => {
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
                    document.getElementById('start-btn').textContent = data.intro.start_button;
                    document.getElementById('callout-1').textContent = data.intro["callout-1"];
                    document.getElementById('callout-2').textContent = data.intro["callout-2"];
                    document.getElementById('callout-3').textContent = data.intro["callout-3"];
                    document.getElementById('yes-desc').textContent = data.intro["yes-desc"];
                    document.getElementById('no-desc').textContent = data.intro["no-desc"];



                    initConsentLogic(data.intro);
                } else if (currentPage === "choice_experiment") {
                    // For choice_experiment.html
                    document.querySelector('.instruction-text p').textContent = data.choice_experiment.instruction_text;
                    document.querySelectorAll('.patient-label')[0].textContent = data.choice_experiment.patient_label_1;
                    document.querySelectorAll('.patient-label')[1].textContent = data.choice_experiment.patient_label_2;
                    document.querySelector('.doctor-instruction').textContent = data.choice_experiment.doctor_instruction;
                    document.querySelector('.highlight-text').textContent = data.choice_experiment.reconsider_message;
                    document.querySelector('.decision-text').textContent = data.choice_experiment.decision_text;
                    document.querySelectorAll('.selection-label')[0].textContent = data.choice_experiment.originally_selected;
                    document.querySelectorAll('.selection-label')[1].textContent = data.choice_experiment.recommendation;
                    document.querySelector('.btn-change').textContent = data.choice_experiment.yes_button;
                    document.querySelector('.btn-keep').textContent = data.choice_experiment.no_button;

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
                    if (nextBtn && data.group_preferences.next_button) {
                        nextBtn.textContent = data.group_preferences.next_button;
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
                    // For procedural_rating.html
                    document.querySelector('.rating-container p').textContent = data.procedural_ratings.rating_intro;
                    document.querySelector('.prev-btn').textContent = data.procedural_ratings.previous_button;
                    document.querySelector('.next-btn').textContent = data.procedural_ratings.next_button;

                    const questionId = document.querySelector('input[name="question_id"]').value;
                    if (data.procedural_ratings.questions) {
                        const question = data.procedural_ratings.questions.find(q => q.id === questionId);
                        if (question) {
                            document.querySelector('.question-label').textContent = question.label;
                            document.querySelector('.question-description').textContent = question.full_text.replace(question.label + ': ', '');
                        }
                    }


                    // Update fairness labels dynamically
                    const labels = document.querySelectorAll(".scale-buttons .circle-label");
                    if (labels.length > 0) {
                        labels[0].textContent = data.procedural_ratings.not_fair;   // first label
                        labels[labels.length - 1].textContent = data.procedural_ratings.very_fair; // last label
                    }

                } else if (currentPage === "results") {
                    // For results.html
                    document.querySelector('h2').textContent = data.results.user_responses;
                    document.querySelector('.download-button').textContent = data.results.download_button;
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
            .catch(error => console.error('Error loading language file:', error));
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
            'patient_1_overweight': 'Overweight_simpler.jpg',
            'patient_2_disability': 'Disability.jpg',
            'patient_1_child': 'child_simple.jpg',
            'patient_2_elderly_couple': 'old_male_female_simpler.jpg',
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
        const live = document.getElementById('consent-live');
        console.log("Found radios:", radios.length);


        function updateConsentButton() {
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

        radios.forEach(r => r.addEventListener('change', updateConsentButton));
        updateConsentButton();
    }





});

// Add this outside the DOMContentLoaded event handler
window.updateModalTranslations = function () {
    const currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
    fetch(`/static/lang/${currentLanguage}.json`)
        .then(response => response.json())
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
        .catch(error => console.error('Error loading modal translations:', error));
};

