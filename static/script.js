// DOM Elements
const gridSizeSelect = document.getElementById('grid-size');
const difficultySelect = document.getElementById('difficulty');
const generateBtn = document.getElementById('generate-btn');
const checkSolutionBtn = document.getElementById('check-solution-btn');
const undoBtn = document.getElementById('undo-btn'); // New: Undo Button
const redoBtn = document.getElementById('redo-btn'); // New: Redo Button
const sudokuGrid = document.getElementById('sudoku-grid');
const messagesDiv = document.getElementById('messages');
const timerDisplay = document.getElementById('timer');
const bestTimeDisplay = document.getElementById('best-time'); // Best Time Display

// New DOM elements for history modal
const viewHistoryBtn = document.getElementById('view-history-btn');
const gameHistoryModal = document.getElementById('game-history-modal');
const closeModalBtn = document.querySelector('.close-button');
const historyList = document.getElementById('history-list');

const usernameInput = document.getElementById('username'); // Username Input

let currentSize = parseInt(gridSizeSelect.value); // Default to 9
let currentDifficulty = difficultySelect.value; // Default to medium
let currentUsername = usernameInput.value.trim(); // Initialize current username

let timerInterval; // Variable to hold the interval ID
let startTime;     // Variable to store the start time
let currentGameData = null; // Global variable to store current game's data, including solution and current state

// Stacks for undo/redo functionality
let historyStack = [];
let redoStack = [];

// Function to get current username (or default)
function getCurrentUsername() {
    return usernameInput.value.trim() || 'Guest';
}

// Function to format time as MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Helper function to display messages with dynamic styling
function showMessage(text, type = 'info', duration = 3000) {
    messagesDiv.textContent = text;
    messagesDiv.className = 'messages'; // Reset classes
    messagesDiv.classList.add(type);
    
    // Clear message after a duration, or clear on next input/message
    setTimeout(() => {
        if (messagesDiv.textContent === text) { // Only clear if it's still the same message
            messagesDiv.textContent = '';
            messagesDiv.className = 'messages';
        }
    }, duration);
}

// Function to start the timer
function startTimer() {
    stopTimer(); // Clear any existing timer
    startTime = Date.now();
    timerDisplay.textContent = formatTime(0);
    timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        timerDisplay.textContent = formatTime(elapsedSeconds);
    }, 1000);
}

// Function to stop the timer
function stopTimer() {
    clearInterval(timerInterval);
}

// Function to get best time from localStorage
function getBestTime(size, difficulty) {
    const username = getCurrentUsername();
    const key = `bestTime_${username}_${size}x${size}_${difficulty}`;
    return parseInt(localStorage.getItem(key)) || Infinity;
}

// Function to set best time to localStorage
function setBestTime(size, difficulty, timeInSeconds) {
    const username = getCurrentUsername();
    const key = `bestTime_${username}_${size}x${size}_${difficulty}`;
    localStorage.setItem(key, timeInSeconds.toString());
    updateBestTimeDisplay();
}

// Function to update the best time display
function updateBestTimeDisplay() {
    const bestTime = getBestTime(currentSize, currentDifficulty);
    if (bestTime === Infinity) {
        bestTimeDisplay.textContent = '--:--';
    } else {
        bestTimeDisplay.textContent = formatTime(bestTime);
    }
}

// Function to save game performance data
function saveGamePerformance(puzzle, solution, size, difficulty, gameStartTime, gameEndTime = Date.now(), status) {
    const durationMs = gameEndTime - gameStartTime;
    const durationSeconds = Math.floor(durationMs / 1000);
    const username = getCurrentUsername(); // Get current username for record

    const gameRecord = {
        id: Date.now(), // Unique ID for the game record
        username: username, // New: Add username to game record
        initial_puzzle: puzzle, // Initial puzzle board
        solution: solution, // The solved board (for verification or replay)
        size: size,
        difficulty: difficulty,
        startTime: gameStartTime,
        endTime: gameEndTime,
        duration: durationMs, // Duration in milliseconds
        status: status
    };

    let history = JSON.parse(localStorage.getItem('sudokuGameHistory')) || [];
    history.push(gameRecord);
    localStorage.setItem('sudokuGameHistory', JSON.stringify(history));
    console.log(`Game ${status} and saved to history.`, gameRecord);

    // If game was completed successfully, check for new best time
    if (status === 'completed') {
        const currentBest = getBestTime(size, difficulty);
        if (durationSeconds < currentBest) {
            setBestTime(size, difficulty, durationSeconds);
            showMessage(`New best time for ${size}x${size} ${difficulty} puzzle by ${username}: ${formatTime(durationSeconds)}!`, 'success', 5000);
        }
    }
}

// Function to fetch a new Sudoku puzzle
async function fetchPuzzle(size, difficulty) {
    showMessage('Generating new puzzle...', 'info');
    try {
        const response = await fetch(`/generate_puzzle/${size}/${difficulty}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        showMessage('Puzzle generated successfully!', 'success');
        return { puzzle: data.puzzle, solution: data.solution }; // Return both puzzle and solution
    } catch (error) {
        console.error('Error fetching puzzle:', error);
        showMessage('Error generating puzzle. Please try again.', 'error-message', 5000);
        return null;
    }
}

// Function to get the current state of the board from the DOM
function getCurrentBoardState() {
    const size = currentSize;
    const board = Array(size).fill(0).map(() => Array(size).fill(0));
    const cells = sudokuGrid.querySelectorAll('.sudoku-cell');

    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        const value = parseInt(cell.textContent) || 0;
        board[r][c] = value;
    });
    return board;
}

// Sudoku validation helper functions
function isValidSudokuMove(board, row, col, num, size) {
    // Check row
    for (let x = 0; x < size; x++) {
        if (x !== col && board[row][x] === num) {
            return false;
        }
    }

    // Check column
    for (let x = 0; x < size; x++) {
        if (x !== row && board[x][col] === num) {
            return false;
        }
    }

    // Check box
    const boxSize = Math.sqrt(size);
    const startRow = row - (row % boxSize);
    const startCol = col - (col % boxSize);
    for (let i = 0; i < boxSize; i++) {
        for (let j = 0; j < boxSize; j++) {
            if ((startRow + i !== row || startCol + j !== col) && board[startRow + i][startCol + j] === num) {
                return false;
            }
        }
    }
    return true;
}

// Function to check if the grid is completely filled
function checkGridCompletion() {
    const currentBoard = currentGameData.currentBoard;
    for (let r = 0; r < currentSize; r++) {
        for (let c = 0; c < currentSize; c++) {
            if (currentBoard[r][c] === 0) {
                return false; // Found an empty cell
            }
        }
    }
    return true; // All cells are filled
}

// Function to check the solution
function checkSolution() {
    stopTimer(); // Stop timer when checking solution
    const currentBoard = getCurrentBoardState();

    // Clear previous error highlights
    document.querySelectorAll('.sudoku-cell.error').forEach(cell => cell.classList.remove('error'));

    if (!currentGameData || !currentGameData.solution) {
        showMessage('No solution available to check against.', 'error-message', 5000);
        return;
    }

    const solution = currentGameData.solution;
    let isSolved = true;

    for (let r = 0; r < currentSize; r++) {
        for (let c = 0; c < currentSize; c++) {
            const cellElement = sudokuGrid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (currentBoard[r][c] !== solution[r][c]) {
                isSolved = false;
                cellElement.classList.add('error'); // Highlight incorrect cells
            }
        }
    }

    if (isSolved) {
        showMessage('Congratulations! Puzzle solved correctly!', 'success', 5000);
        saveGamePerformance(currentGameData.initial_puzzle, currentGameData.solution, currentGameData.size, currentGameData.difficulty, currentGameData.startTime, Date.now(), 'completed');
    } else {
        showMessage('Solution is incorrect. Incorrect cells are highlighted.', 'error-message', 5000);
    }
}

// Function to render the Sudoku grid
function renderSudokuGrid(puzzleAndSolution) {
    if (!puzzleAndSolution || !puzzleAndSolution.puzzle || !puzzleAndSolution.solution) return;

    const puzzle = puzzleAndSolution.puzzle;
    const solution = puzzleAndSolution.solution; // Store the solution

    sudokuGrid.innerHTML = ''; // Clear previous grid
    sudokuGrid.className = ''; // Clear previous classes
    sudokuGrid.classList.add(`grid-${currentSize}x${currentSize}`);

    const size = puzzle.length;

    // Reset undo/redo stacks for a new puzzle
    historyStack = [];
    redoStack = [];

    // Initialize currentBoardState with the initial puzzle (user editable parts are 0)
    const initialBoardState = puzzle.map(row => [...row]);

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement('div');
            cell.classList.add('sudoku-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            const value = puzzle[r][c];
            if (value !== 0) {
                cell.textContent = value;
                cell.classList.add('fixed');
            } else {
                cell.classList.add('editable');
                cell.contentEditable = true; // Allow user input
                cell.addEventListener('input', handleCellInput);
                cell.addEventListener('focus', handleCellFocus);
                cell.addEventListener('blur', handleCellBlur);
            }
            sudokuGrid.appendChild(cell);
        }
    }
    // Initial setup for thicker borders for 9x9 grid blocks
    applyGridBorders(size);
    startTimer(); // Start timer when a new puzzle is rendered
    updateBestTimeDisplay(); // Update best time display for the new puzzle parameters

    // Update currentGameData with details of the new puzzle, including the solution and current board state
    currentGameData = {
        initial_puzzle: puzzle, // Store the initial puzzle state
        solution: solution, // Store the solved board for checking
        size: currentSize,
        difficulty: currentDifficulty,
        startTime: startTime, // From the timer's start time
        currentBoard: initialBoardState // The current state of the board, will be updated by user input
    };
}

function applyGridBorders(size) {
    const cells = sudokuGrid.querySelectorAll('.sudoku-cell');
    const boxSize = Math.sqrt(size);

    cells.forEach((cell) => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        // Apply thick right border for box boundaries
        if ((col + 1) % boxSize === 0 && col !== size - 1) {
            cell.style.borderRightWidth = '2px';
        } else {
            cell.style.borderRightWidth = '1px';
        }
        // Apply thick bottom border for box boundaries
        if ((row + 1) % boxSize === 0 && row !== size - 1) {
            cell.style.borderBottomWidth = '2px';
        } else {
            cell.style.borderBottomWidth = '1px';
        }
    });
}

// Function to apply a move (for undo/redo)
function applyMove(move) {
    const { row, col, value } = move;
    const cellElement = sudokuGrid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cellElement && cellElement.classList.contains('editable')) {
        cellElement.textContent = value === 0 ? '' : value;
        if (currentGameData && currentGameData.currentBoard) {
            currentGameData.currentBoard[row][col] = value;
        }
        // Re-run validation for the cell if it's not empty
        if (value !== 0) {
            const numValue = parseInt(value);
            if (!isValidSudokuMove(currentGameData.currentBoard, row, col, numValue, currentSize)) {
                cellElement.classList.add('error');
                showMessage('Invalid move: Duplicate number in row, column, or block.', 'error-message');
            } else {
                cellElement.classList.remove('error');
                showMessage('Keep going!', 'info');
            }
        } else {
            cellElement.classList.remove('error');
            showMessage('', 'info', 0); // Clear message immediately
        }
    }
}

// Function to undo the last move
function undoMove() {
    if (historyStack.length > 0) {
        const lastMove = historyStack.pop();
        const { row, col, oldValue } = lastMove;

        // Store the current state (before undo) for redo
        const currentValue = currentGameData.currentBoard[row][col];
        redoStack.push({ row, col, value: currentValue, oldValue: oldValue });

        applyMove({ row, col, value: oldValue });
        showMessage('Undo successful.', 'info');
    } else {
        showMessage('Nothing to undo.', 'info');
    }
}

// Function to redo the last undone move
function redoMove() {
    if (redoStack.length > 0) {
        const lastRedoMove = redoStack.pop();
        const { row, col, value, oldValue } = lastRedoMove;

        // Store the current state (before redo) for undo
        historyStack.push({ row, col, oldValue: oldValue }); // Store original value for future undo

        applyMove({ row, col, value });
        showMessage('Redo successful.', 'info');
    } else {
        showMessage('Nothing to redo.', 'info');
    }
}

// Event listener for user input in editable cells
function handleCellInput(event) {
    let value = event.target.textContent.trim();
    const row = parseInt(event.target.dataset.row);
    const col = parseInt(event.target.dataset.col);

    // Store old value before potential change for undo
    const oldValue = currentGameData.currentBoard[row][col];

    // Validate input: should be a single digit matching grid size
    const maxDigit = currentSize; // Max allowed digit for the current grid size
    const regex = new RegExp(`^[1-${maxDigit}]$`);

    let numValue = 0;
    if (value.length > 1) {
        value = value.charAt(0);
    }

    if (value === '' || regex.test(value)) {
        numValue = (value === '') ? 0 : parseInt(value);
        event.target.textContent = value; // Update cell content

        // Update the current game board state
        if (currentGameData && currentGameData.currentBoard) {
            currentGameData.currentBoard[row][col] = numValue;
        }

        // Record move for undo if value actually changed and it's an editable cell
        if (oldValue !== numValue && event.target.classList.contains('editable')) {
            historyStack.push({ row, col, oldValue: oldValue });
            redoStack = []; // Clear redo stack on new move
        }

        // Perform Sudoku rule validation
        if (numValue !== 0 && !isValidSudokuMove(currentGameData.currentBoard, row, col, numValue, currentSize)) {
            event.target.classList.add('error');
            showMessage('Invalid move: Duplicate number in row, column, or block.', 'error-message');
        } else {
            event.target.classList.remove('error');
            showMessage('Keep going!', 'info');

            // If the input is valid and the grid is complete, automatically check solution
            if (numValue !== 0 && checkGridCompletion()) {
                checkSolution();
            }
        }

        // Clear message if cell is empty and no other error exists
        if (numValue === 0) {
            event.target.classList.remove('error');
            if (!document.querySelector('.sudoku-cell.error')) {
                showMessage('', 'info', 0); // Clear message immediately
            }
        }

    } else {
        event.target.textContent = ''; // Clear invalid input
        if (currentGameData && currentGameData.currentBoard) {
            currentGameData.currentBoard[row][col] = 0;
        }
        event.target.classList.remove('error'); // Remove error class for invalid input attempt
        showMessage('Invalid input: Please enter a single digit.', 'error-message');
    }
}

function handleCellFocus(event) {
    // Highlight selected cell
    document.querySelectorAll('.sudoku-cell.selected').forEach(cell => cell.classList.remove('selected'));
    event.target.classList.add('selected');
}

function handleCellBlur(event) {
    event.target.classList.remove('selected');
    // Clear messages specific to individual cell input on blur if no other error exists
    if (!document.querySelector('.sudoku-cell.error')) {
        showMessage('', 'info', 0); // Clear message immediately
    }
}

// Function to display game history
function displayGameHistory() {
    historyList.innerHTML = ''; // Clear previous list
    const history = JSON.parse(localStorage.getItem('sudokuGameHistory')) || [];

    if (history.length === 0) {
        historyList.innerHTML = '<p>No game history found.</p>';
        return;
    }

    // Filter history for current user or show all if username is 'Guest'
    const currentUser = getCurrentUsername();
    const filteredHistory = history.filter(record => currentUser === 'Guest' || record.username === currentUser);

    if (filteredHistory.length === 0) {
        historyList.innerHTML = `<p>No game history found for ${currentUser}.</p>`;
        return;
    }

    filteredHistory.forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.classList.add('history-record');

        const durationSeconds = Math.floor(record.duration / 1000);
        const formattedDuration = formatTime(durationSeconds);

        recordDiv.innerHTML = `
            <p><strong>Username:</strong> ${record.username}</p>
            <p><strong>Game ID:</strong> ${record.id}</p>
            <p><strong>Size:</strong> ${record.size}x${record.size}</p>
            <p><strong>Difficulty:</strong> ${record.difficulty}</p>
            <p><strong>Status:</strong> ${record.status}</p>
            <p><strong>Duration:</strong> ${formattedDuration}</p>
            <hr/>
        `;
        historyList.appendChild(recordDiv);
    });
}

// Event Listeners for controls
gridSizeSelect.addEventListener('change', (event) => {
    currentSize = parseInt(event.target.value);
    updateBestTimeDisplay(); // Update best time when size changes
});

difficultySelect.addEventListener('change', (event) => {
    currentDifficulty = event.target.value;
    updateBestTimeDisplay(); // Update best time when difficulty changes
});

usernameInput.addEventListener('input', () => {
    currentUsername = getCurrentUsername(); // Update currentUsername variable
    updateBestTimeDisplay(); // Update best time when username changes
});

generateBtn.addEventListener('click', async () => {
    // Ensure currentUsername is up-to-date before saving
    currentUsername = getCurrentUsername(); 
    // Save the current game as 'reset' before generating a new one
    if (currentGameData) {
        saveGamePerformance(currentGameData.initial_puzzle, currentGameData.solution, currentGameData.size, currentGameData.difficulty, currentGameData.startTime, Date.now(), 'reset');
        currentGameData = null; // Clear current game data
    }
    const puzzleAndSolution = await fetchPuzzle(currentSize, currentDifficulty);
    if (puzzleAndSolution) {
        renderSudokuGrid(puzzleAndSolution);
    }
});

checkSolutionBtn.addEventListener('click', checkSolution);
undoBtn.addEventListener('click', undoMove); // Event listener for undo
redoBtn.addEventListener('click', redoMove); // Event listener for redo

// Event Listeners for history modal
viewHistoryBtn.addEventListener('click', () => {
    displayGameHistory(); // Load and display history before opening
    gameHistoryModal.style.display = 'block';
});

closeModalBtn.addEventListener('click', () => {
    gameHistoryModal.style.display = 'none';
});

window.addEventListener('click', (event) => {
    if (event.target == gameHistoryModal) {
        gameHistoryModal.style.display = 'none';
    }
});

// Initial puzzle generation on page load
document.addEventListener('DOMContentLoaded', async () => {
    currentUsername = getCurrentUsername(); // Initialize currentUsername on load
    const puzzleAndSolution = await fetchPuzzle(currentSize, currentDifficulty);
    if (puzzleAndSolution) {
        renderSudokuGrid(puzzleAndSolution);
    }
    updateBestTimeDisplay(); // Display best time on initial load
});
