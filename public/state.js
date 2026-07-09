let authState = {
    isLoading:       true,
    currentUser:     null,
    sessionExpiry:   null,
    sessionExpiring: false,
    sessionExpired:  false,
    activeTab:       'login',
    errorMessage:    '',
    loginForm:       { username: '', password: '' },
    registerForm:    { username: '', password: '', city: '', zone: '' },
    resetMode:       false,
    resetToken:      '',
    resetPassword:   '',
    resetSuccess:    false,
    resetError:      '',
};

let appState = {
    outages:       [],
    activeOutage:  null,
    currentTab:    'dashboard',
    isLoading:     true,
    startDate:     getTodayDate(),
    startTime:     getCurrentTime(),
    endDate:       getTodayDate(),
    endTime:       getCurrentTime(),
    endNotes:         '',
    showManualForm:   false,
    manualDate:       getTodayDate(),
    manualStartTime:  '00:00',
    manualEndTime:    '00:00',
    manualNotes:      '',
    confirmDeleteId:  null,
    editOutageId:     null,
    editDate:         '',
    editStartTime:    '00:00',
    editEndTime:      '00:00',
    editMood:         null,
    editNotes:        '',
    historyPage:      1,
    selectedMood:     null,
};

let profileState = {
    isOpen:               false,
    profileData:          null,
    isLoading:            false,
    editCity:             '',
    editZone:             '',
    isPublic:             true,
    currentPassword:      '',
    newPassword:          '',
    passwordError:        '',
    passwordUpdated:      false,
    changesSaved:         false,
    confirmDelete:        false,
    telegramToken:        null,
    telegramTokenExpiry:  null,
    telegramTokenLoading: false,
};

let communityState = {
    isLoading: false,
    data:      null,
};

let lastNotifiedHour = -1;
