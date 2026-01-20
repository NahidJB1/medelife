<script>
    
    // --- INIT DOCTOR DATA ---
    const role = localStorage.getItem('userRole');
    if(role !== 'doctor') { window.location.href = 'index.html'; }

    const name = localStorage.getItem('userName') || 'Dr. User';
    const storedEmail = localStorage.getItem('userEmail');
    
    // CRITICAL FIX: Always use the raw Email as the User ID
    // This ensures the ID is consistent regardless of login method
    if (!storedEmail) {
        console.error("Critical: User email missing from session.");
        window.location.href = 'index.html'; // Redirect to login if email is lost
    }

    const stableId = storedEmail; // ID is now "doctor@gmail.com"

    const currentUserData = { name: name, role: 'doctor', uid: stableId, email: storedEmail };
    db.collection('users').doc(stableId).get().then(doc => {
    if(doc.exists && doc.data().profilePic) {
        document.getElementById('sideAvatar').src = doc.data().profilePic;
    }
});
    
    document.getElementById('sideName').innerText = name;
    document.getElementById('welcomeTitle').innerText = "Hello, " + name;
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // SYNC DOCTOR: Creates/Updates the doctor document with the Email ID
    db.collection('users').doc(stableId).set({
        name: currentUserData.name, 
        role: 'doctor', 
        email: currentUserData.email
    }, { merge: true });


    // --- TAB SWITCHING ---
    function switchMainTab(el, tabName) {
        document.querySelectorAll('.tab-item, .nav-item').forEach(t => t.classList.remove('active'));
        if(el) el.classList.add('active');
        
        const allNavs = document.querySelectorAll('.nav-item');
        if(tabName === 'home') allNavs[0].classList.add('active');
        if(tabName === 'community') allNavs[1].classList.add('active');

        const contentArea = document.getElementById('tabContentArea');

        if (tabName === 'home') {
            contentArea.innerHTML = `
            <div class="action-section">
                <div class="section-title">Quick Actions</div>
                <div class="quick-actions">
                    <div class="action-card" onclick="openAppointmentList('pending')"><i class="fas fa-calendar-check" style="color:#F59E0B"></i><h4>Requests</h4><p>Pending Approvals</p></div>
                    <div class="action-card" onclick="openAppointmentList('accepted')"><i class="fas fa-clipboard-list"></i><h4>View Bookings</h4><p>Confirmed Patients</p></div>
                    <div class="action-card" onclick="openPatientSearch()"><i class="fas fa-user-injured"></i><h4>Find Patient</h4><p>View History & Prescribe</p></div>
                </div>
            </div>`;
        } else if (tabName === 'community') {
            loadCommunityFeed(contentArea);
        }
    }

    // --- DOCTOR FUNCTIONS ---
    function openAppointmentList(filterType) {
        const title = filterType === 'pending' ? 'Appointment Requests' : 'Confirmed Bookings';
        
        // [Task A] Header with Link to switch views
        let headerHtml = `<h2 style="margin:0;">${title}</h2>`;
        if(filterType === 'pending') {
            headerHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="margin:0;">${title}</h2>
                <span onclick="openAppointmentList('accepted')" style="cursor:pointer; color:var(--secondary); font-size:0.9rem; font-weight:600;">
                    <i class="fas fa-arrow-right"></i> Go to Bookings
                </span>
            </div>`;
        } else {
             headerHtml = `<h2 style="margin-bottom:15px;">${title}</h2>`;
        }

        modalContent.innerHTML = `${headerHtml}<div id="aptList">Loading...</div>`;
        modal.classList.add('active');

        db.collection('appointments').where('doctorId', '==', currentUserData.uid).get().then(snap => {
            const list = document.getElementById('aptList'); list.innerHTML = '';
            let count = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if(data.status !== filterType) return;
                count++;
                
                let btns = '';
                let infoExtra = '';

                if(filterType === 'pending') {
                    // Show Patient's Requested Time in List
                    const reqTime = data.preferredTime ? `<br><small style="color:#F59E0B; font-weight:600;"><i class="far fa-clock"></i> Requested: ${data.preferredTime}</small>` : '';
                    
                    infoExtra = reqTime;
                    btns = `<button class="list-btn btn-accept" onclick="updateApt('${doc.id}','accepted')">Accept</button>
                            <button class="list-btn btn-decline" onclick="updateApt('${doc.id}','declined')">Decline</button>`;
                } else {
                    // [Task B] Pass 'data.preferredTime' to openTimePicker
                    btns = `<button class="list-btn btn-time" title="Set Time" onclick="openTimePicker('${doc.id}', '${data.scheduledTime || ''}', '${data.preferredTime || ''}')"><i class="fas fa-clock"></i></button>
                            <button class="list-btn btn-book" onclick="openDoctorPatientView('${data.patientId}','${data.patientName}')">Profile</button>
                            <button class="list-btn btn-cancel" onclick="cancelAppointment('${doc.id}')">Cancel</button>`;
                }

                list.innerHTML += `
                    <div class="list-item">
                        <div>
                            <strong>${data.patientName}</strong>
                            <br><small>Date: ${new Date(data.requestDate).toLocaleDateString()}</small>
                            ${data.scheduledTime ? `<br><small style="color:#2563EB; font-weight:600;">Scheduled: ${data.scheduledTime}</small>` : ''}
                            ${infoExtra}
                        </div>
                        <div style="text-align:right; display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">${btns}</div>
                    </div>`;
            });
            if(count === 0) list.innerHTML = `<p>No ${filterType} appointments.</p>`;
        });
    }

    function updateApt(id, status) {
        db.collection('appointments').doc(id).update({ status: status }).then(() => { showToast("Updated!"); openAppointmentList('pending'); });
    }

    // [Task C] Replaced prompt with a UI Modal
    // [Task B] Updated to show Requested Time
    function openTimePicker(docId, currentVal, reqTime) {
        let reqDisplay = '';
        if(reqTime && reqTime !== 'undefined' && reqTime !== '') {
            reqDisplay = `
            <div style="background:#FFFBEB; border:1px solid #FCD34D; padding:10px; border-radius:8px; margin-bottom:15px; font-size:0.9rem; color:#92400E;">
                <i class="far fa-clock"></i> <strong>Patient Requested:</strong> ${reqTime}
            </div>`;
        }

        modalContent.innerHTML = `
            <h3>Set Appointment Time</h3>
            <p style="color:var(--gray); margin-bottom:15px; font-size:0.9rem;">Confirm the time for this visit.</p>
            ${reqDisplay}
            <input type="text" id="newTimeInput" value="${currentVal && currentVal !== 'undefined' ? currentVal : ''}" class="rx-input" style="min-height:auto; margin-bottom:20px;" placeholder="e.g. 10:30 AM">
            <button class="list-btn btn-book" style="width:100%; padding:12px;" onclick="saveTime('${docId}')">Save Time</button>
        `;
        modal.classList.add('active');
    }

    function saveTime(docId) {
        const time = document.getElementById('newTimeInput').value;
        if(!time) { showToast("Please enter a time"); return; }
        
        db.collection('appointments').doc(docId).update({ scheduledTime: time }).then(()=>{ 
            showToast("Time Updated Successfully"); 
            // Return to list or close
            openAppointmentList('accepted'); 
        });
    }

    // [Task C] Removed native confirm alert
    function cancelAppointment(id) {
        db.collection('appointments').doc(id).delete().then(()=>{ 
            showToast("Appointment Cancelled"); 
            openAppointmentList('accepted'); 
        });
    }

    function openPatientSearch() {
        modalContent.innerHTML = `
            <h2 style="text-align:center;">Patient Lookup</h2>
            <div class="modern-search-bar"><i class="fas fa-search search-icon"></i>
            <input type="text" id="sInput" class="search-input-field" placeholder="Enter Patient Email..."><button class="search-btn-modern" onclick="performSearch()">Search</button></div>
            <div id="searchResults" style="max-height:400px;overflow-y:auto"></div>`;
        modal.classList.add('active');
    }

    // [REPLACE] The entire performSearch function
    // [REPLACE] The entire performSearch function
    function performSearch() {
        const email = document.getElementById('sInput').value.trim();
        const div = document.getElementById('searchResults');
        if(!email) { showToast("Enter email"); return; }
        div.innerHTML = 'Searching...';

        db.collection('users').where('email', '==', email).get().then(snap => {
            div.innerHTML = '';
            if(snap.empty) { div.innerHTML = '<p style="text-align:center">No patient found.</p>'; return; }
            
            // [Fix B] Prevent Duplicates using a Set
            const seenEmails = new Set();
            
            snap.forEach(doc => {
                const d = doc.data();
                // If we have already displayed this email in this search result, skip it
                if(seenEmails.has(d.email)) return;
                
                seenEmails.add(d.email);
                
                div.innerHTML += `
                <div class="list-item">
                    <div>
                        <strong>${d.name}</strong>
                        <br><small>${d.email}</small>
                    </div>
                    <button class="list-btn btn-view" onclick="openDoctorPatientView('${doc.id}','${d.name}')">View Profile</button>
                </div>`;
            });
        });
    }

    // --- UPDATED DOCTOR PATIENT VIEW ---
    // --- UPDATED DOCTOR PATIENT VIEW ---
    let currentViewingPatient = null;
    let currentAppointmentId = null;

    // [REPLACE] The entire openDoctorPatientView function
    function openDoctorPatientView(pid, pname) {
        currentViewingPatient = { id: pid, name: pname };
        modalContent.innerHTML = `<h2>Loading Patient...</h2>`;
        modal.classList.add('active');

        Promise.all([
            db.collection('users').doc(currentUserData.uid).get(),
            db.collection('users').doc(pid).get(),
            // [Fix A] Query ALL appointments (pending OR accepted) to check for permissions
            db.collection('appointments')
                .where('doctorId', '==', currentUserData.uid)
                .where('patientId', '==', pid)
                .get() 
        ]).then(([docSnap, patSnap, aptSnap]) => {
            
            // 1. Prepare Basic Data
            const docInfo = docSnap.data() || {};
            const patInfo = patSnap.exists ? patSnap.data() : { name: pname };
            
            // 2. Determine Access State
            let hasAccess = false;
            let accessRequestStatus = null;
            let currentAppointmentId = null; // Will hold the ID of the most relevant appointment

            if(!aptSnap.empty) {
                // Loop through all appointments to find if ANY grant access
                aptSnap.forEach(doc => {
                    const apt = doc.data();
                    
                    // If we haven't picked a main ID yet, pick this one
                    if (!currentAppointmentId) currentAppointmentId = doc.id;
                    
                    // If this specific appointment grants access, Unlock everything
                    if (apt.shareDocuments === true) {
                        hasAccess = true;
                    }
                    
                    // Prioritize showing 'pending' request status if it exists
                    if (apt.accessRequest === 'pending') {
                        accessRequestStatus = 'pending';
                    }
                    
                    // If we find an accepted booking, prioritize its ID for logic
                    if (apt.status === 'accepted') {
                        currentAppointmentId = doc.id;
                    }
                });
            }

            // 3. Render Header (Always Visible)
            let html = `
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                    <img src="${patInfo.profilePic || 'https://via.placeholder.com/60'}" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">
                    <div>
                        <h2 style="font-size:1.3rem;">${patInfo.name}</h2>
                        <p style="color:var(--gray); font-size:0.9rem;">
                            ${patInfo.gender || 'Gender: N/A'} • ${patInfo.age ? patInfo.age + ' Yrs' : 'Age: N/A'}
                            <br>Blood: ${patInfo.bloodGroup || 'N/A'}
                        </p>
                    </div>
                </div>`;

            // 4. Render Body based on Access
            if (hasAccess) {
                // --- UNLOCKED VIEW (Write Rx, View Reports) ---
                
                const docObjRaw = {
                    name: docInfo.name || currentUserData.name,
                    spec: docInfo.specialist || docInfo.speciality || 'Medical Professional',
                    deg: docInfo.degrees || docInfo.degree || docInfo.qualification || '',
                    addr: docInfo.address || docInfo.chamberAddress || docInfo.chamber || 'Address not available',
                    time: docInfo.time || docInfo.schedule || '',
                    phone: docInfo.phone || docInfo.mobile || '',
                    email: docInfo.email || ''
                };
                
                const drDetailsObj = JSON.stringify(docObjRaw).replace(/"/g, '&quot;');

                html += `
                    <div class="modal-tabs">
                        <div class="m-tab-item active" onclick="switchModalTab('presc')">Prescriptions</div>
                        <div class="m-tab-item" onclick="switchModalTab('reports')">Reports</div>
                    </div>

                    <div id="tab-presc" class="m-tab-content">
                        <div class="dual-btn-row">
                            <button onclick="renderWritePrescription('${patInfo.name}', '${patInfo.gender||''}', '${patInfo.age||''}', ${drDetailsObj})">
                                <i class="fas fa-pen"></i> Write Prescription
                            </button>
                            <button onclick="triggerUpload('Prescription')">
                                <i class="fas fa-upload"></i> Upload File
                            </button>
                        </div>
                        <div id="prescHistoryList">Loading history...</div>
                    </div>

                    <div id="tab-reports" class="m-tab-content" style="display:none;">
                        <div style="background:#F9FAFB; padding:15px; border-radius:10px; border:1px solid #E5E7EB; margin-bottom:15px;">
                            <label style="font-size:0.85rem; font-weight:600; color:var(--gray); display:block; margin-bottom:8px;">Document Type:</label>
                            <select id="reportCategorySelect" class="rx-input" style="min-height:auto; height:45px; margin-bottom:10px; background:white;">
                                <option value="General Report">General Lab Report</option>
                                <option value="Blood Test">Blood Test</option>
                                <option value="X-Ray">X-Ray</option>
                                <option value="ECG">ECG</option>
                                <option value="MRI">MRI</option>
                                <option value="CT Scan">CT Scan</option>
                                <option value="Ultrasound">Ultrasound</option>
                                <option value="Discharge Summary">Discharge Summary</option>
                                <option value="Other">Other</option>
                            </select>
                            <button class="list-btn btn-book" style="width:100%; padding:10px;" onclick="triggerUpload('Report')">
                                <i class="fas fa-cloud-upload-alt"></i> Select File & Upload
                            </button>
                        </div>
                        <div id="reportHistoryList">Loading reports...</div>
                    </div>
                    
                    <input type="file" id="docUploadInput" hidden onchange="handleDocUpload(this)">
                    <input type="hidden" id="uploadType">
                `;
                
                modalContent.innerHTML = html;
                loadPatientHistory('Prescription', 'prescHistoryList', docObjRaw);
                loadPatientHistory('Report', 'reportHistoryList', docObjRaw);

            } else {
                // --- LOCKED / ACCESS DENIED VIEW ---
                
                let actionArea = '';
                
                if (currentAppointmentId) {
                    // Scenario A: Booking exists (Pending or Accepted), but privacy is ON.
                    if(accessRequestStatus === 'pending') {
                         actionArea = `<button class="list-btn" disabled style="background:#F59E0B; color:white;">Request Pending...</button>`;
                    } else {
                         actionArea = `<button class="list-btn btn-book" onclick="requestDocAccess('${currentAppointmentId}')">Request Access</button>`;
                    }
                } else {
                    // Scenario B: No Booking found.
                    actionArea = `<p style="font-size:0.85rem; color:#EF4444; background:#FEF2F2; padding:8px 15px; border-radius:6px;">
                        <i class="fas fa-info-circle"></i> Confirmed booking required to request access.
                    </p>`;
                }

                html += `
                    <div class="access-denied-box">
                        <i class="fas fa-lock" style="font-size:3rem; color:#9CA3AF; margin-bottom:15px;"></i>
                        <h3>Profile Locked</h3>
                        <p style="color:var(--gray); margin-bottom:20px;">
                            ${currentAppointmentId ? 'Patient has restricted document access.' : 'You do not have a confirmed appointment with this patient.'}
                        </p>
                        
                        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                            ${actionArea}
                        </div>
                    </div>
                `;
                modalContent.innerHTML = html;
            }
        });
    }

    // [REPLACE] The entire loadPatientHistory function
    function loadPatientHistory(typeFilter, containerId, fallbackDrDetails = {}) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<small>Loading...</small>';
        
        db.collection('reports')
            .where('patientId', '==', currentViewingPatient.id)
            .where('reportType', '==', typeFilter) 
            .orderBy('timestamp', 'desc') 
            .get()
            .then(snap => {
                container.innerHTML = '';
                if(snap.empty) { container.innerHTML = `<small style="color:var(--gray)">No ${typeFilter}s found.</small>`; return; }
                
                snap.forEach(doc => {
                    const d = doc.data();
                    const date = d.timestamp ? new Date(d.timestamp.toDate()).toLocaleDateString() : 'N/A';
                    const displayTitle = d.docCategory ? d.docCategory : d.reportType;
                    const pName = d.patientName || currentViewingPatient.name || 'Patient';
                    const docName = d.doctorName || fallbackDrDetails.name || 'Doctor';

                    let actionBtn = '';
                    
                    if(d.isManual) {
                        const safeContent = d.content.replace(/`/g, "'").replace(/\$/g, "").replace(/\\/g, "\\\\");
                        
                        // Use saved details if they exist and have data, otherwise merge/use fallback
                        // This fixes the "Old prescriptions don't show updated profile" issue
                        let finalDrDetails = d.doctorDetails || {};
                        if(!finalDrDetails.spec && fallbackDrDetails.spec) finalDrDetails = fallbackDrDetails;

                        const drDetailsStr = JSON.stringify(finalDrDetails).replace(/"/g, '&quot;');

                        actionBtn = `<button class="list-btn btn-view" 
                            onclick="openDocViewer('manual', \`${safeContent}\`, '${displayTitle}', '${docName}', '${pName}', '${date}', ${drDetailsStr})">
                            <i class="fas fa-eye"></i> Read Rx
                        </button>`;
                    } else {
                        actionBtn = `<button class="list-btn btn-view" 
                            onclick="openDocViewer('file', '${d.fileData}', '${displayTitle}')">
                            <i class="fas fa-file-alt"></i> View File
                        </button>`;
                    }

                    container.innerHTML += `
                        <div class="list-item" style="background:#F9FAFB;">
                            <div>
                                <strong>${displayTitle}</strong>
                                <br>
                                <small style="color:var(--gray);">${date} • By: ${docName}</small>
                            </div>
                            ${actionBtn}
                        </div>`;
                });
            }).catch(err => {
                console.log("Error loading history:", err);
                container.innerHTML = "<small>Refresh required (Indexing).</small>";
            });
    }

    // [REPLACE] The entire openDocViewer function
    function openDocViewer(type, content, title, docName = 'Doctor', patName = 'Patient', dateStr = 'N/A', drDetails = {}) {
        const viewerModal = document.getElementById('documentViewerModal');
        const viewerContent = document.getElementById('docViewerContent');
        
        let html = '';
        
        if (type === 'manual') {
            const dSpec = drDetails.spec || 'Medical Professional';
            const dDeg = drDetails.deg || '';
            const dAddr = drDetails.addr || 'Address not available';
            
            // Format Schedule: Split by '|' and join with <br> for multi-line
            let dTime = drDetails.time || '';
            if(dTime.includes('|')) {
                dTime = dTime.split('|').map(t => t.trim()).join('<br>');
            }

            const dPhone = drDetails.phone || '';
            const dEmail = drDetails.email || '';

            html = `
                <div class="rx-paper" style="border: none; box-shadow: none; padding: 10px; max-width: 800px; margin: 0 auto; background: white;">
                    
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
                        
                        <div style="flex: 1; min-width: 250px; margin-bottom: 15px;">
                             <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                                 <svg width="24" height="24" viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" rx="5" fill="#EF4444" /><rect x="10" y="35" width="80" height="30" rx="5" fill="#EF4444" /></svg>
                                 <div style="font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: 700; line-height: 1;"><span style="color: #EF4444;">MED</span><span style="color: #000;">e</span><span style="color: #22C55E;">LIFE</span></div>
                             </div>
                             
                             <h2 style="font-size: 1.6rem; margin: 0; color: #111;">Dr. ${docName}</h2>
                             <p style="color: #EF4444; font-weight: 600; font-size: 0.95rem; margin-top: 2px;">${dSpec}</p>
                             ${dDeg ? `<p style="color: #6B7280; font-size: 0.85rem; max-width: 300px;">${dDeg}</p>` : ''}
                        </div>

                        <div style="text-align: right; min-width: 200px; font-size: 0.85rem; color: #374151;">
                             <p style="margin-bottom: 8px;"><strong>Chamber:</strong><br>${dAddr}</p>
                             ${dTime ? `<p style="margin-bottom: 8px;"><strong>Schedule:</strong><br>${dTime}</p>` : ''}
                             <p style="margin-top: 8px;"><strong>Contact:</strong><br>
                                ${dPhone ? dPhone + '<br>' : ''}
                                ${dEmail ? dEmail : ''}
                             </p>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #E5E7EB; padding-bottom: 15px; margin-bottom: 25px; font-size: 0.95rem; color: #374151;">
                        <div>
                            <span style="font-weight: 700; color: #111;">Patient: ${patName}</span>
                            ${drDetails.pAge ? `<br><span style="font-size: 0.9rem; color: #4B5563;">Age: ${drDetails.pAge} • Gender: ${drDetails.pGender||'N/A'}</span>` : ''} 
                            <br><span style="font-size: 0.85rem; color: #6B7280;">Rx ID: #${Math.floor(Math.random()*10000) + 1000}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-weight: 700;">Date: ${dateStr}</span><br>
                            <span style="font-size: 0.85rem; color: #6B7280;">Consultation: Online</span>
                        </div>
                    </div>

                    <div class="rx-body-bg" style="background: #FAFAFA; padding: 30px; border-radius: 8px; border: 1px dashed #E5E7EB; min-height: 400px; position: relative;">
                        <span style="font-family: 'Times New Roman', serif; font-style: italic; font-weight: bold; font-size: 2.5rem; color: #333; position: absolute; top: 20px; left: 20px;">Rx</span>
                        <div style="margin-top: 60px; white-space: pre-wrap; font-family: 'Poppins', sans-serif; font-size: 1rem; line-height: 1.8; color: #1F2937;">${content}</div>
                    </div>

                    <div class="rx-footer" style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
                        <small style="color: #9CA3AF;">Generated digitally via MEDeLIFE</small>
                        <div style="text-align: center;">
                            <div style="font-family: 'Cursive', serif; font-size: 1.5rem; color: #EF4444; opacity: 0.7;">Signed</div>
                            <div style="border-top: 1px solid #333; width: 150px; margin-top: 5px;"></div>
                            <small style="font-weight: 600;">Dr. ${docName}</small>
                        </div>
                    </div>
                </div>

                <div class="no-print" style="margin-top: 20px; text-align: right; border-top: 1px solid #eee; padding-top: 15px;">
                    <button class="list-btn btn-book" onclick="window.print()">
                        <i class="fas fa-print"></i> Print / Save as PDF
                    </button>
                </div>
            `;
        } else {
            // File View
            html = `
                <h3 style="margin-bottom: 10px;">${title}</h3>
                <iframe src="${content}" style="width: 100%; flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; background: #f1f1f1;"></iframe>
            `;
        }
        
        viewerContent.innerHTML = html;
        viewerModal.classList.add('active');
    }

    
    // --- HELPER: Tabs Switcher ---
    function switchModalTab(tab) {
        document.querySelectorAll('.m-tab-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.m-tab-content').forEach(el => el.style.display = 'none');
        
        if(tab === 'presc') {
            document.querySelectorAll('.m-tab-item')[0].classList.add('active');
            document.getElementById('tab-presc').style.display = 'block';
        } else {
            document.querySelectorAll('.m-tab-item')[1].classList.add('active');
            document.getElementById('tab-reports').style.display = 'block';
        }
    }

    // --- HELPER: Request Access ---
    function requestDocAccess(aptId) {
        db.collection('appointments').doc(aptId).update({
            accessRequest: 'pending'
        }).then(() => {
            showToast("Request sent to patient");
            openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name); // Refresh view
        });
    }

    // --- HELPER: Write Prescription UI ---
   // --- HELPER: Write Prescription UI (Updated Layout) ---
    // We store the current doctor details in a global variable for saving later
    let tempDoctorDetails = {};

    function renderWritePrescription(pName, pGen, pAge, docDetails) {
        // Store patient meta in the docDetails snapshot for saving
        tempDoctorDetails = {
            ...docDetails,
            pAge: pAge || 'N/A',
            pGender: pGen || 'N/A'
        };

        // Format Time for Display: Split by '|' for multi-line
        let displayTime = docDetails.time || 'Not set';
        if(displayTime.includes('|')) {
            displayTime = displayTime.split('|').map(t => t.trim()).join('<br>');
        }

        const headerHtml = `
            <div class="rx-header" style="border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between;">
                
                <div style="flex: 1; min-width: 200px; text-align: left;">
                    <div style="display:flex; align-items:center; gap:5px; margin-bottom:10px;">
                         <svg width="24" height="24" viewBox="0 0 100 100"><rect x="35" y="10" width="30" height="80" rx="5" fill="#EF4444" /><rect x="10" y="35" width="80" height="30" rx="5" fill="#EF4444" /></svg>
                         <div style="font-weight:700; font-size:16px; line-height:1;"><span style="color:#EF4444;">MED</span><span style="color:#000;">e</span><span style="color:#22C55E;">LIFE</span></div>
                    </div>
                    <h3 style="font-size: 1.2rem; margin-bottom: 2px;">Dr. ${docDetails.name}</h3>
                    <p style="color: var(--primary); font-weight: 600; font-size: 0.9rem;">${docDetails.spec}</p>
                    <p style="color: var(--gray); font-size: 0.85rem;">${docDetails.deg}</p>
                </div>

                <div style="text-align: right; min-width: 200px; font-size: 0.85rem; color: #374151;">
                    <p style="margin-bottom: 5px;"><strong>Chamber:</strong><br>${docDetails.addr || 'Address not set'}</p>
                    <p style="margin-bottom: 5px;"><strong>Schedule:</strong><br>${displayTime}</p>
                    <p><strong>Contact:</strong><br>${docDetails.phone || ''}<br>${docDetails.email || ''}</p>
                </div>
            </div>

            <div class="rx-meta">
                <span><strong>Pt:</strong> ${pName}</span>
                <span><strong>Age:</strong> ${pAge ? pAge+'Y' : '-'} &nbsp;|&nbsp; <strong>Gender:</strong> ${pGen ? pGen : '-'}</span>
                <span><strong>Date:</strong> ${new Date().toLocaleDateString()}</span>
            </div>
        `;

        document.getElementById('tab-presc').innerHTML = `
            <div class="rx-paper">
                ${headerHtml}
                <textarea id="rxBody" class="rx-input" placeholder="Rx: \n\n1. Medicine Name - Dosage - Duration..."></textarea>
                <div style="margin-top:20px; text-align:right;">
                    <button class="list-btn" style="background:var(--gray); color:white; margin-right:10px;" onclick="openDoctorPatientView('${currentViewingPatient.id}', '${currentViewingPatient.name}')">Cancel</button>
                    <button class="list-btn btn-book" onclick="saveWrittenPrescription()">Save & Print</button>
                </div>
            </div>
        `;
    }

    function saveWrittenPrescription() {
        const content = document.getElementById('rxBody').value;
        if(!content) { showToast("Prescription is empty"); return; }
        
        db.collection('reports').add({
            patientId: currentViewingPatient.id,
            patientName: currentViewingPatient.name,
            doctorId: currentUserData.uid,
            doctorName: currentUserData.name,
            reportType: 'Prescription',
            isManual: true,
            content: content,
            doctorDetails: tempDoctorDetails, // Includes pAge and pGender now
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            showToast("Prescription Saved");
            openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name);
        });
    }

    // --- HELPER: Upload Logic ---
    function triggerUpload(type) {
        document.getElementById('uploadType').value = type;
        document.getElementById('docUploadInput').click();
    }

    function handleDocUpload(input) {
        const type = document.getElementById('uploadType').value; // 'Prescription' or 'Report'
        
        // Determine specific category
        let specificCategory = type; 
        if(type === 'Report') {
            const selector = document.getElementById('reportCategorySelect');
            if(selector) specificCategory = selector.value; // e.g., "X-Ray"
        }

        if(input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                db.collection('reports').add({
                    patientId: currentViewingPatient.id,
                    patientName: currentViewingPatient.name,
                    doctorId: currentUserData.uid,
                    doctorName: currentUserData.name,
                    reportType: type,          // Used for Tab Filtering (Prescription vs Report)
                    docCategory: specificCategory, // Used for Display (e.g., X-Ray, ECG)
                    fileData: e.target.result,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }).then(() => {
                    showToast(specificCategory + " Uploaded");
                    openDoctorPatientView(currentViewingPatient.id, currentViewingPatient.name); // Refresh to show new item
                });
            }
            reader.readAsDataURL(input.files[0]);
        }
    }


    
    function toggleLike(pid, liked) { db.collection('posts').doc(pid).update({ likes: liked ? firebase.firestore.FieldValue.arrayRemove(currentUserData.uid) : firebase.firestore.FieldValue.arrayUnion(currentUserData.uid) }); }
    function sendComment(pid) {
        const t = document.getElementById('i-'+pid).value; if(!t) return;
        db.collection('posts').doc(pid).update({ comments: firebase.firestore.FieldValue.arrayUnion({ text: t, author: currentUserData.name, role: 'doctor' }) });
    }

    // --- FIX: MISSING COMMUNITY FUNCTION ---
    function loadCommunityFeed(container) {
        container.innerHTML = `
            <div class="create-post-card">
                <textarea id="newPostText" class="cp-input-area" style="width:100%; border:none; outline:none;" placeholder="Share a health tip..."></textarea>
                <div style="text-align:right; margin-top:10px;">
                    <button class="list-btn btn-book" onclick="publishPost()">Post</button>
                </div>
            </div>
            <div id="feedStream">Loading...</div>
        `;

        db.collection('posts').orderBy('timestamp', 'desc').onSnapshot(snap => {
            const feed = document.getElementById('feedStream');
            if(!feed) return;
            feed.innerHTML = '';
            snap.forEach(doc => {
                const p = doc.data();
                feed.innerHTML += `
                    <div class="post-card">
                        <div class="post-header"><strong>${p.authorName}</strong> <span class="role-badge role-${p.authorRole}">${p.authorRole}</span></div>
                        <p>${p.content}</p>
                        <div class="interaction-bar"><small>${p.likes ? p.likes.length : 0} Likes</small></div>
                    </div>`;
            });
        });
    }

    function publishPost() {
        const txt = document.getElementById('newPostText').value;
        if(txt) db.collection('posts').add({
            authorName: currentUserData.name, authorRole: 'doctor', authorId: currentUserData.uid,
            content: txt, likes: [], comments: [], timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    

function closeDocViewer() {
    document.getElementById('documentViewerModal').classList.remove('active');
}
    </script>
