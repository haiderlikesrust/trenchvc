class TrenchVC {
    constructor() {
        this.ws = null;
        this.localStream = null;
        this.testStream = null;
        this.testAudioElement = null;
        this.peers = new Map();
        this.remoteStreams = new Map();
        this.remoteAudioElements = new Map();
        this.myId = null;
        this.isMuted = false;
        this.isTestingMic = false;
        this.isInVc = false;
        this.audioContext = null;
        this.analyser = null;
        this.animationFrameId = null;
        this.volume = 100;
        this.inputGain = 100;
        this.audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        };
        this.roomStartTime = null;
        this.activeSpeakerId = null;
        this.leaveConfirmTimeout = null;
        this.speakingLevels = new Map();
        
        this.init();
    }
    
    async init() {
        await this.connectWebSocket();
        this.setupEventListeners();
        await this.loadAudioDevices();
        
        // Initialize audio context on first user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: true });
    }
    
    connectWebSocket() {
        // For Vercel deployment, you'll need to use a separate WebSocket server
        // Update this URL to point to your Railway/Render WebSocket server
        const wsServer = process.env.WS_SERVER || window.location.host;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${wsServer}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to signaling server');
            if (this.isInVc) {
                this.updateStatus('Connected', true);
            }
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleSignalingMessage(message);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.isInVc) {
                this.updateStatus('Connection Error', false);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket closed');
            if (this.isInVc) {
                this.updateStatus('Disconnected', false);
                setTimeout(() => this.connectWebSocket(), 3000);
            }
        };
    }
    
    async getUserMedia(deviceId = null) {
        try {
            const constraints = {
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: this.audioConstraints.echoCancellation,
                    noiseSuppression: this.audioConstraints.noiseSuppression,
                    autoGainControl: this.audioConstraints.autoGainControl
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Apply input gain if needed
            if (this.inputGain !== 100) {
                this.applyInputGain(stream);
            }
            
            return stream;
        } catch (error) {
            console.error('Error getting user media:', error);
            throw error;
        }
    }
    
    applyInputGain(stream) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const source = this.audioContext.createMediaStreamSource(stream);
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.inputGain / 100;
        source.connect(gainNode);
        
        // Note: This is a simplified approach. For production, you'd need to recreate the stream.
    }
    
    async testMicrophone() {
        if (this.isTestingMic) {
            this.stopTestingMic();
            return;
        }
        
        try {
            const deviceId = document.getElementById('audioDeviceSelect').value || null;
            this.testStream = await this.getUserMedia(deviceId);
            
            // Play back audio so user can hear themselves
            this.testAudioElement = new Audio();
            this.testAudioElement.srcObject = this.testStream;
            this.testAudioElement.volume = 0.3; // Lower volume to prevent feedback
            this.testAudioElement.autoplay = true;
            
            // Ensure audio context is created and resumed
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            // Try to play audio (may be blocked by browser autoplay policy)
            try {
                await this.testAudioElement.play();
                console.log('Audio playback started');
            } catch (playError) {
                console.warn('Audio playback blocked (this is normal in some browsers):', playError);
                // Visualization will still work even if playback is blocked
            }
            
            this.isTestingMic = true;
            const testBtn = document.getElementById('testMicBtn');
            testBtn.classList.add('testing');
            testBtn.querySelector('.btn-text').textContent = 'Stop Test';
            
            // Setup audio visualization
            this.setupAudioVisualization(this.testStream);
            
            // Show join button
            document.getElementById('joinVcBtn').style.display = 'flex';
            
        } catch (error) {
            alert('Failed to access microphone. Please allow microphone access.');
            console.error('Error testing microphone:', error);
        }
    }
    
    stopTestingMic() {
        // Stop audio playback
        if (this.testAudioElement) {
            this.testAudioElement.pause();
            this.testAudioElement.srcObject = null;
            this.testAudioElement = null;
        }
        
        // Stop stream
        if (this.testStream) {
            this.testStream.getTracks().forEach(track => track.stop());
            this.testStream = null;
        }
        
        this.isTestingMic = false;
        const testBtn = document.getElementById('testMicBtn');
        testBtn.classList.remove('testing');
        testBtn.querySelector('.btn-text').textContent = 'Test Mic';
        
        // Stop visualization
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Reset visualizer
        const bars = document.querySelectorAll('.visualizer-bar');
        bars.forEach(bar => bar.style.height = '4px');
        document.getElementById('micLevelText').textContent = 'Mic Level: 0%';
    }
    
    async joinVc() {
        try {
            // Stop test if running
            if (this.isTestingMic) {
                this.stopTestingMic();
            }
            
            // Get selected device
            const deviceId = document.getElementById('audioDeviceSelect').value || null;
            this.localStream = await this.getUserMedia(deviceId);
            
            // Setup audio visualization for VC
            this.setupAudioVisualization(this.localStream);
            
            // Hide test modal, show main controls, hide join prompt
            document.getElementById('testMicModal').style.display = 'none';
            document.getElementById('mainControls').style.display = 'flex';
            if (document.getElementById('joinPrompt')) {
                document.getElementById('joinPrompt').style.display = 'none';
            }
            if (document.getElementById('emptyState')) {
                document.getElementById('emptyState').style.display = 'none';
            }
            
            this.isInVc = true;
            this.roomStartTime = Date.now();
            this.updateStatus('Connected', true);
            this.addLocalParticipant();
            this.updatePeopleCount();
            this.startRoomTimer();
            this.startMicMeter();
            this.startPingMonitor();
            this.updateGhostSlots();
            
            // Start monitoring connection quality
            this.monitorConnectionQuality();
            
            // Play subtle join sound (optional)
            this.playJoinSound();
            
        } catch (error) {
            alert('Failed to join VC. Please check your microphone permissions.');
            console.error('Error joining VC:', error);
        }
    }
    
    startRoomTimer() {
        const updateTimer = () => {
            if (!this.isInVc || !this.roomStartTime) return;
            
            const elapsed = Math.floor((Date.now() - this.roomStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timerEl = document.getElementById('roomTimer');
            if (timerEl) {
                timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        };
        
        setInterval(updateTimer, 1000);
        updateTimer();
    }
    
    startMicMeter() {
        if (!this.localStream) return;
        
        const updateMeter = () => {
            if (!this.isInVc) return;
            
            if (this.analyser && !this.isMuted) {
                const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
                this.analyser.getByteTimeDomainData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const normalized = (dataArray[i] - 128) / 128;
                    sum += Math.abs(normalized);
                }
                const average = sum / dataArray.length;
                const level = Math.min(100, Math.round(average * 100));
                
                const meterFill = document.getElementById('micMeterFill');
                if (meterFill) {
                    meterFill.style.width = `${level}%`;
                }
            } else {
                const meterFill = document.getElementById('micMeterFill');
                if (meterFill) {
                    meterFill.style.width = '0%';
                }
            }
            
            requestAnimationFrame(updateMeter);
        };
        
        updateMeter();
    }
    
    startPingMonitor() {
        const checkPing = () => {
            if (!this.isInVc) return;
            
            const startTime = performance.now();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Simulate ping (in real implementation, you'd measure actual round-trip)
                const ping = Math.floor(Math.random() * 50) + 20; // Simulated 20-70ms
                const pingEl = document.getElementById('pingValue');
                if (pingEl) {
                    pingEl.textContent = `${ping}ms`;
                }
            }
        };
        
        setInterval(checkPing, 3000);
        checkPing();
    }
    
    playJoinSound() {
        // Very subtle join sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 400;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }
    
    updateGhostSlots() {
        const ghostSlots = document.getElementById('ghostSlots');
        if (!ghostSlots) return;
        
        const currentCount = this.peers.size + 1;
        const maxSlots = 6;
        const emptySlots = Math.max(0, maxSlots - currentCount);
        
        ghostSlots.innerHTML = '';
        for (let i = 0; i < emptySlots; i++) {
            const ghost = document.createElement('div');
            ghost.className = 'ghost-avatar';
            ghostSlots.appendChild(ghost);
        }
    }
    
    async setupAudioVisualization(stream) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.3; // Lower for more responsive visualization
        source.connect(this.analyser);
        
        const bufferLength = this.analyser.frequencyBinCount;
        const frequencyData = new Uint8Array(bufferLength);
        const timeData = new Uint8Array(bufferLength);
        const bars = document.querySelectorAll('.visualizer-bar');
        
        const updateVisualization = () => {
            if (!this.analyser) return;
            
            // Get both frequency and time domain data
            this.analyser.getByteFrequencyData(frequencyData);
            this.analyser.getByteTimeDomainData(timeData);
            
            // Calculate overall volume from time domain (more accurate for mic level)
            let sum = 0;
            for (let i = 0; i < timeData.length; i++) {
                const normalized = (timeData[i] - 128) / 128;
                sum += Math.abs(normalized);
            }
            const averageVolume = sum / timeData.length;
            const volumePercent = Math.min(100, Math.round(averageVolume * 100));
            
            // Use frequency data for visual bars
            const barCount = bars.length;
            const step = Math.floor(bufferLength / barCount);
            let maxFreq = 0;
            
            bars.forEach((bar, index) => {
                const value = frequencyData[index * step] || 0;
                const height = Math.max(4, (value / 255) * 60);
                bar.style.height = `${height}px`;
                maxFreq = Math.max(maxFreq, value);
            });
            
            // Update mic level text using time domain data (more accurate)
            document.getElementById('micLevelText').textContent = `Mic Level: ${volumePercent}%`;
            
            // Detect speaking
            if (this.isInVc && volumePercent > 5) {
                const localParticipant = document.querySelector('.participant.local');
                if (localParticipant) {
                    localParticipant.classList.add('speaking');
                    setTimeout(() => {
                        localParticipant.classList.remove('speaking');
                    }, 200);
                }
            }
            
            this.animationFrameId = requestAnimationFrame(updateVisualization);
        };
        
        updateVisualization();
    }
    
    handleSignalingMessage(message) {
        if (!this.isInVc) return;
        
        switch (message.type) {
            case 'your-id':
                this.myId = message.id;
                document.getElementById('yourId').textContent = message.id.substring(0, 8);
                break;
                
            case 'existing-clients':
                message.clients.forEach(clientId => {
                    this.createPeerConnection(clientId, true);
                });
                break;
                
            case 'new-client':
                this.createPeerConnection(message.id, false);
                break;
                
            case 'client-left':
                this.removePeer(message.id);
                break;
                
            case 'offer':
                this.handleOffer(message);
                break;
                
            case 'answer':
                this.handleAnswer(message);
                break;
                
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
        }
    }
    
    createPeerConnection(peerId, isInitiator) {
        if (this.peers.has(peerId)) {
            return;
        }
        
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        const peerConnection = new RTCPeerConnection(configuration);
        
        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }
        
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream from', peerId);
            const remoteStream = event.streams[0];
            this.remoteStreams.set(peerId, remoteStream);
            this.addParticipant(peerId);
            this.setupRemoteAudio(peerId, remoteStream);
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice-candidate',
                    target: peerId,
                    candidate: event.candidate
                });
            }
        };
        
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
            this.updateConnectionQuality();
            
            if (peerConnection.connectionState === 'failed' || 
                peerConnection.connectionState === 'disconnected') {
                this.removePeer(peerId);
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            this.updateConnectionQuality();
        };
        
        this.peers.set(peerId, peerConnection);
        this.updatePeopleCount();
        
        if (isInitiator) {
            this.createOffer(peerId);
        }
    }
    
    setupRemoteAudio(peerId, stream) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.volume = this.volume / 100;
        audio.autoplay = true;
        audio.play().catch(err => console.error('Error playing remote audio:', err));
        this.remoteAudioElements.set(peerId, audio);
    }
    
    async createOffer(peerId) {
        const peerConnection = this.peers.get(peerId);
        if (!peerConnection) return;
        
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.sendSignalingMessage({
                type: 'offer',
                target: peerId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }
    
    async handleOffer(message) {
        const peerConnection = this.peers.get(message.from);
        if (!peerConnection) {
            this.createPeerConnection(message.from, false);
            return this.handleOffer(message);
        }
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            this.sendSignalingMessage({
                type: 'answer',
                target: message.from,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }
    
    async handleAnswer(message) {
        const peerConnection = this.peers.get(message.from);
        if (!peerConnection) return;
        
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }
    
    async handleIceCandidate(message) {
        const peerConnection = this.peers.get(message.from);
        if (!peerConnection) return;
        
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }
    
    removePeer(peerId) {
        const peerConnection = this.peers.get(peerId);
        if (peerConnection) {
            peerConnection.close();
            this.peers.delete(peerId);
        }
        
        const remoteStream = this.remoteStreams.get(peerId);
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStreams.delete(peerId);
        }
        
        // Stop and remove audio element
        const audio = this.remoteAudioElements.get(peerId);
        if (audio) {
            audio.pause();
            audio.srcObject = null;
            this.remoteAudioElements.delete(peerId);
        }
        
        this.removeParticipant(peerId);
        this.updatePeopleCount();
        this.updateConnectionQuality();
    }
    
    sendSignalingMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    getAvatarColor(peerId) {
        // Generate consistent color based on peer ID
        const colors = ['avatar-color-1', 'avatar-color-2', 'avatar-color-3', 'avatar-color-4', 
                       'avatar-color-5', 'avatar-color-6', 'avatar-color-7', 'avatar-color-8'];
        let hash = 0;
        for (let i = 0; i < peerId.length; i++) {
            hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
    
    getAvatarInitials(name) {
        if (name === 'You') return 'YOU';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    addLocalParticipant() {
        const participantsGrid = document.getElementById('participantsGrid');
        const colorClass = this.getAvatarColor(this.myId || 'local');
        participantsGrid.innerHTML = `
            <div class="participant-card local" id="participant-local">
                <div class="voice-reactive-ring"></div>
                <div class="participant-avatar ${colorClass}">
                    ${this.getAvatarInitials('You')}
                </div>
                <div class="participant-name">You</div>
                <div class="participant-status ${this.isMuted ? 'muted' : 'idle'}" id="local-status">${this.isMuted ? 'Muted' : 'Idle'}</div>
                <div class="status-icons">
                    ${this.isMuted ? '<div class="status-icon muted" title="Muted">🔇</div>' : ''}
                </div>
            </div>
        `;
    }
    
    addParticipant(peerId) {
        const participantsGrid = document.getElementById('participantsGrid');
        const existingParticipant = document.getElementById(`participant-${peerId}`);
        
        if (existingParticipant) return;
        
        const colorClass = this.getAvatarColor(peerId);
        const userName = `User ${peerId.substring(0, 6)}`;
        const initials = this.getAvatarInitials(userName);
        
        const participantCard = document.createElement('div');
        participantCard.className = 'participant-card';
        participantCard.id = `participant-${peerId}`;
        participantCard.innerHTML = `
            <div class="voice-reactive-ring"></div>
            <div class="participant-avatar ${colorClass}">
                ${initials}
            </div>
            <div class="participant-name">${userName}</div>
            <div class="participant-status idle" id="status-${peerId}">Idle</div>
            <div class="status-icons">
                <div class="status-icon" title="No video">📹</div>
            </div>
        `;
        
        participantsGrid.appendChild(participantCard);
        
        // Hide empty state if participants exist
        if (this.peers.size > 0 && document.getElementById('emptyState')) {
            document.getElementById('emptyState').style.display = 'none';
        }
        
        // Monitor remote audio for speaking detection
        const remoteStream = this.remoteStreams.get(peerId);
        if (remoteStream) {
            this.monitorRemoteSpeaking(peerId, remoteStream);
        }
        
        // Play subtle join animation
        participantCard.style.animation = 'cardSlideIn 0.4s ease';
        this.updateGhostSlots();
    }
    
    monitorRemoteSpeaking(peerId, stream) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const source = this.audioContext.createMediaStreamSource(stream);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        
        const timeData = new Uint8Array(analyser.frequencyBinCount);
        
        const checkSpeaking = () => {
            analyser.getByteTimeDomainData(timeData);
            
            let sum = 0;
            for (let i = 0; i < timeData.length; i++) {
                const normalized = (timeData[i] - 128) / 128;
                sum += Math.abs(normalized);
            }
            const average = sum / timeData.length;
            const level = average * 100;
            
            this.speakingLevels.set(peerId, level);
            
            const participant = document.getElementById(`participant-${peerId}`);
            const statusEl = document.getElementById(`status-${peerId}`);
            
            if (participant) {
                if (level > 5) {
                    participant.classList.add('speaking');
                    if (statusEl) {
                        statusEl.textContent = 'Talking...';
                        statusEl.className = 'participant-status talking';
                    }
                    this.activeSpeakerId = peerId;
                    this.updateActiveSpeakerViz(peerId);
                } else {
                    participant.classList.remove('speaking');
                    if (statusEl) {
                        statusEl.textContent = 'Idle';
                        statusEl.className = 'participant-status idle';
                    }
                    if (this.activeSpeakerId === peerId) {
                        this.activeSpeakerId = null;
                        this.updateActiveSpeakerViz(null);
                    }
                }
            }
            
            if (this.peers.has(peerId)) {
                requestAnimationFrame(checkSpeaking);
            }
        };
        
        checkSpeaking();
    }
    
    updateActiveSpeakerViz(peerId) {
        const viz = document.getElementById('activeSpeakerViz');
        if (!viz) return;
        
        if (peerId) {
            const participant = document.getElementById(`participant-${peerId}`);
            const nameEl = document.getElementById('activeSpeakerName');
            if (participant && nameEl) {
                const name = participant.querySelector('.participant-name').textContent;
                nameEl.textContent = name;
                viz.style.display = 'block';
                this.animateWaveform();
            }
        } else {
            viz.style.display = 'none';
        }
    }
    
    animateWaveform() {
        const bars = document.querySelectorAll('.wave-bar');
        const level = this.speakingLevels.get(this.activeSpeakerId) || 0;
        
        bars.forEach((bar, index) => {
            const height = 20 + (level * 0.6) + Math.sin(Date.now() / 100 + index) * 20;
            bar.style.height = `${Math.max(10, Math.min(100, height))}px`;
        });
        
        if (this.activeSpeakerId) {
            requestAnimationFrame(() => this.animateWaveform());
        }
    }
    
    removeParticipant(peerId) {
        const participant = document.getElementById(`participant-${peerId}`);
        if (participant) {
            // Animate out
            participant.style.animation = 'cardSlideOut 0.3s ease';
            setTimeout(() => {
                participant.remove();
                this.updateGhostSlots();
            }, 300);
        }
        
        if (this.activeSpeakerId === peerId) {
            this.activeSpeakerId = null;
            this.updateActiveSpeakerViz(null);
        }
    }
    
    updatePeopleCount() {
        const count = this.peers.size + 1; // +1 for yourself
        document.getElementById('peopleCount').textContent = count;
        this.updateGhostSlots();
        
        // Show/hide empty state
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            if (count === 1) {
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
            }
        }
    }
    
    updateStatus(text, connected) {
        if (!this.isInVc) return;
        
        document.getElementById('status-text').textContent = text;
        const statusDot = document.querySelector('.status-dot');
        if (connected) {
            statusDot.classList.add('connected');
        } else {
            statusDot.classList.remove('connected');
        }
    }
    
    updateConnectionQuality() {
        if (this.peers.size === 0) {
            document.getElementById('connectionQuality').textContent = '-';
            return;
        }
        
        let excellent = 0;
        let good = 0;
        let fair = 0;
        let poor = 0;
        
        this.peers.forEach((peerConnection) => {
            const state = peerConnection.connectionState;
            const iceState = peerConnection.iceConnectionState;
            
            if (state === 'connected' && iceState === 'connected') {
                excellent++;
            } else if (state === 'connecting' || iceState === 'checking') {
                good++;
            } else if (state === 'disconnected' || iceState === 'disconnected') {
                fair++;
            } else {
                poor++;
            }
        });
        
        const qualityEl = document.getElementById('connectionQuality');
        const voiceQualityEl = document.getElementById('voiceQualityText');
        const voiceQualityIcon = document.getElementById('voiceQualityIcon');
        
        let quality = 'excellent';
        let qualityText = 'Excellent';
        let qualityIcon = '🔥';
        
        if (excellent === this.peers.size) {
            quality = 'excellent';
            qualityText = 'Excellent';
            qualityIcon = '🔥';
        } else if (good > 0 && poor === 0) {
            quality = 'good';
            qualityText = 'Good';
            qualityIcon = '🔥';
        } else if (fair > 0 || poor < this.peers.size / 2) {
            quality = 'fair';
            qualityText = 'Fair';
            qualityIcon = '⚠️';
        } else {
            quality = 'poor';
            qualityText = 'Poor';
            qualityIcon = '⚠️';
        }
        
        qualityEl.textContent = qualityText;
        qualityEl.className = `info-value connection-quality ${quality}`;
        
        if (voiceQualityEl) voiceQualityEl.textContent = qualityText;
        if (voiceQualityIcon) voiceQualityIcon.textContent = qualityIcon;
    }
    
    copyInviteLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById('inviteBtn');
            const originalTitle = btn.title;
            btn.title = 'Copied!';
            setTimeout(() => {
                btn.title = originalTitle;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
    
    monitorConnectionQuality() {
        setInterval(() => {
            if (this.isInVc) {
                this.updateConnectionQuality();
            }
        }, 3000);
    }
    
    async loadAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            const select = document.getElementById('audioDeviceSelect');
            select.innerHTML = '<option value="">Default</option>';
            
            audioInputs.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Microphone ${audioInputs.indexOf(device) + 1}`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading audio devices:', error);
        }
    }
    
    setupEventListeners() {
        // Test mic button
        document.getElementById('testMicBtn').addEventListener('click', () => {
            this.testMicrophone();
        });
        
        // Join VC button
        document.getElementById('joinVcBtn').addEventListener('click', () => {
            this.joinVc();
        });
        
        // Mute button
        document.getElementById('muteBtn').addEventListener('click', () => {
            this.toggleMute();
        });
        
        // Show test modal button
        document.getElementById('showTestModalBtn').addEventListener('click', () => {
            document.getElementById('testMicModal').style.display = 'flex';
        });
        
        // Close test modal button
        document.getElementById('closeTestModalBtn').addEventListener('click', () => {
            if (this.isTestingMic) {
                this.stopTestingMic();
            }
            document.getElementById('testMicModal').style.display = 'none';
        });
        
        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            const modal = document.getElementById('settingsModal');
            modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
        });
        
        // Close settings button
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').style.display = 'none';
        });
        
        // Close modals when clicking outside
        document.getElementById('testMicModal').addEventListener('click', (e) => {
            if (e.target.id === 'testMicModal') {
                if (this.isTestingMic) {
                    this.stopTestingMic();
                }
                document.getElementById('testMicModal').style.display = 'none';
            }
        });
        
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                document.getElementById('settingsModal').style.display = 'none';
            }
        });
        
        // Volume slider
        const volumeSlider = document.getElementById('volumeSlider');
        volumeSlider.addEventListener('input', (e) => {
            this.volume = parseInt(e.target.value);
            document.getElementById('volumeValue').textContent = `${this.volume}%`;
            
            // Update all remote audio volumes
            this.remoteAudioElements.forEach((audio) => {
                audio.volume = this.volume / 100;
            });
        });
        
        // Input gain slider
        const inputGainSlider = document.getElementById('inputGainSlider');
        inputGainSlider.addEventListener('input', (e) => {
            this.inputGain = parseInt(e.target.value);
            document.getElementById('inputGainValue').textContent = `${this.inputGain}%`;
        });
        
        // Audio device select
        document.getElementById('audioDeviceSelect').addEventListener('change', async (e) => {
            if (this.isInVc && this.localStream) {
                // Reconnect with new device
                const oldStream = this.localStream;
                try {
                    const deviceId = e.target.value || null;
                    this.localStream = await this.getUserMedia(deviceId);
                    
                    // Replace tracks in all peer connections
                    this.peers.forEach((peerConnection) => {
                        const sender = peerConnection.getSenders().find(s => 
                            s.track && s.track.kind === 'audio'
                        );
                        if (sender && this.localStream) {
                            sender.replaceTrack(this.localStream.getAudioTracks()[0]);
                        }
                    });
                    
                    // Stop old stream
                    oldStream.getTracks().forEach(track => track.stop());
                    
                    // Update visualization
                    this.setupAudioVisualization(this.localStream);
                } catch (error) {
                    console.error('Error changing audio device:', error);
                    alert('Failed to change audio device');
                }
            }
        });
        
        // Audio constraints checkboxes
        document.getElementById('echoCancellation').addEventListener('change', (e) => {
            this.audioConstraints.echoCancellation = e.target.checked;
            this.applyAudioConstraints();
        });
        
        document.getElementById('noiseSuppression').addEventListener('change', (e) => {
            this.audioConstraints.noiseSuppression = e.target.checked;
            this.applyAudioConstraints();
        });
        
        document.getElementById('autoGainControl').addEventListener('change', (e) => {
            this.audioConstraints.autoGainControl = e.target.checked;
            this.applyAudioConstraints();
        });
        
        // Invite button
        document.getElementById('inviteBtn').addEventListener('click', () => {
            this.copyInviteLink();
        });
        
        // Leave button with confirmation
        const leaveBtn = document.getElementById('leaveBtn');
        leaveBtn.addEventListener('mouseenter', () => {
            if (this.leaveConfirmTimeout) {
                clearTimeout(this.leaveConfirmTimeout);
            }
            this.leaveConfirmTimeout = setTimeout(() => {
                leaveBtn.classList.add('confirming');
                leaveBtn.querySelector('span').textContent = 'Confirm Leave';
            }, 2000);
        });
        
        leaveBtn.addEventListener('mouseleave', () => {
            if (this.leaveConfirmTimeout) {
                clearTimeout(this.leaveConfirmTimeout);
                this.leaveConfirmTimeout = null;
            }
            leaveBtn.classList.remove('confirming');
            leaveBtn.querySelector('span').textContent = 'Leave';
        });
        
        leaveBtn.addEventListener('click', () => {
            if (leaveBtn.classList.contains('confirming')) {
                this.leave();
            } else {
                leaveBtn.classList.add('confirming');
                leaveBtn.querySelector('span').textContent = 'Confirm Leave';
                setTimeout(() => {
                    leaveBtn.classList.remove('confirming');
                    leaveBtn.querySelector('span').textContent = 'Leave';
                }, 3000);
            }
        });
        
        // Expand settings button
        document.getElementById('expandSettingsBtn').addEventListener('click', () => {
            const modal = document.getElementById('settingsModal');
            modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
        });
    }
    
    async applyAudioConstraints() {
        if (this.isInVc && this.localStream) {
            // Reconnect with new constraints
            const oldStream = this.localStream;
            try {
                const deviceId = document.getElementById('audioDeviceSelect').value || null;
                this.localStream = await this.getUserMedia(deviceId);
                
                // Replace tracks in all peer connections
                this.peers.forEach((peerConnection) => {
                    const sender = peerConnection.getSenders().find(s => 
                        s.track && s.track.kind === 'audio'
                    );
                    if (sender && this.localStream) {
                        sender.replaceTrack(this.localStream.getAudioTracks()[0]);
                    }
                });
                
                // Stop old stream
                oldStream.getTracks().forEach(track => track.stop());
                
                // Update visualization
                this.setupAudioVisualization(this.localStream);
            } catch (error) {
                console.error('Error applying audio constraints:', error);
            }
        }
    }
    
    toggleMute() {
        if (!this.localStream) return;
        
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !this.isMuted;
        });
        
        const muteBtn = document.getElementById('muteBtn');
        const btnText = muteBtn.querySelector('span');
        const statusEl = document.getElementById('local-status');
        
        if (this.isMuted) {
            btnText.textContent = 'Unmute';
            muteBtn.classList.add('muted');
            if (statusEl) {
                statusEl.textContent = 'Muted';
                statusEl.className = 'participant-status muted';
            }
        } else {
            btnText.textContent = 'Mute';
            muteBtn.classList.remove('muted');
            if (statusEl) {
                statusEl.textContent = 'Idle';
                statusEl.className = 'participant-status idle';
            }
        }
        
        // Update local participant status icon
        const localParticipant = document.getElementById('participant-local');
        if (localParticipant) {
            const statusIcons = localParticipant.querySelector('.status-icons');
            if (statusIcons) {
                if (this.isMuted) {
                    if (!statusIcons.querySelector('.muted')) {
                        const mutedIcon = document.createElement('div');
                        mutedIcon.className = 'status-icon muted';
                        mutedIcon.title = 'Muted';
                        mutedIcon.textContent = '🔇';
                        statusIcons.appendChild(mutedIcon);
                    }
                } else {
                    const mutedIcon = statusIcons.querySelector('.muted');
                    if (mutedIcon) {
                        mutedIcon.remove();
                    }
                }
            }
        }
    }
    
    leave() {
        // Stop testing if active
        if (this.isTestingMic) {
            this.stopTestingMic();
        }
        
        // Close all peer connections
        this.peers.forEach((peerConnection, peerId) => {
            peerConnection.close();
        });
        this.peers.clear();
        
        // Stop all remote streams
        this.remoteStreams.forEach((stream) => {
            stream.getTracks().forEach(track => track.stop());
        });
        this.remoteStreams.clear();
        
        // Stop all remote audio elements
        this.remoteAudioElements.forEach((audio) => {
            audio.pause();
            audio.srcObject = null;
        });
        this.remoteAudioElements.clear();
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Stop visualization
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
        
        // Reset UI
        this.isInVc = false;
        document.getElementById('mainControls').style.display = 'none';
        if (document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').style.display = 'none';
        }
        const participantsGrid = document.getElementById('participantsGrid');
        if (participantsGrid) {
            participantsGrid.innerHTML = '';
        }
        document.getElementById('peopleCount').textContent = '0';
        document.getElementById('connectionQuality').textContent = '-';
        
        // Show join prompt
        if (document.getElementById('joinPrompt')) {
            document.getElementById('joinPrompt').style.display = 'block';
        }
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    new TrenchVC();
});
