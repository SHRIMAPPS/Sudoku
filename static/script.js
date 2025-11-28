let currentPuzzle = [];
let currentSize = 9;
let timerInterval;
let seconds = 0;
let focusedCell = null; // To keep track of the currently focused cell
let initialPuzzle = []; // To store the original puzzle state for comparison

// Undo/Redo stacks
let history = [];
let redoStack = [];

const sudokuGrid = document.getElementById('sudoku-grid');
const generateBtn = document.getElementById('generate-btn');
const sizeSelect = document.getElementById('size-select');
const difficultySelect = document.getElementById('difficulty-select');
const timerDisplay = document.getElementById('timer-display');
const gameOverMessage = document.getElementById('game-over-message');
const newGameBtn = document.getElementById('new-game-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const completionSound = document.getElementById('completion-sound');
const saveGameBtn = document.getElementById('save-game-btn');
const loadGameBtn = document.getElementById('load-game-btn');
const loadGameIdInput = document.getElementById('load-game-id');
const hintBtn = document.getElementById('hint-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// Function to update the disabled state of undo/redo buttons
function updateUndoRedoButtons() {
    undoBtn.disabled = history.length <= 1; // Always keep at least the initial state
    redoBtn.disabled = redoStack.length === 0;
}

// Function to save current state to history
function saveState() {
    const state = {
        puzzle: JSON.parse(JSON.stringify(currentPuzzle)),
        size: currentSize,
        difficulty: difficultySelect.value,
        time: seconds
    };
    history.push(state);
    redoStack = []; // Clear redo stack on new action
    updateUndoRedoButtons();
}

// Utility to start/reset the timer
function startTimer() {
    clearInterval(timerInterval);
    seconds = 0;
    timerDisplay.textContent = '00:00';
    gameOverMessage.style.display = 'none'; // Hide game over message
    completionSound.pause(); // Stop sound if playing
    completionSound.currentTime = 0; // Reset sound

    timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerDisplay.textContent =
            `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Utility to stop the timer
function stopTimer() {
    clearInterval(timerInterval);
}

// Function to remove all highlights and error feedback from the grid
function clearAllFeedback() {
    const allCells = sudokuGrid.querySelectorAll('.cell');
    allCells.forEach(cell => {
        cell.classList.remove('highlight-row', 'highlight-col', 'focused', 'error-cell', 'error-row', 'error-col', 'error-block', 'hint-highlight');
        const input = cell.querySelector('.user-input');
        if (input) {
            input.classList.remove('invalid-input');
        }
    });
}

// Function to highlight row and column of the focused cell
function highlightRowAndColumn(row, col) {
    clearAllFeedback(); // Clear all feedback including errors

    const allCells = sudokuGrid.querySelectorAll('.cell');

    allCells.forEach((cell, index) => {
        const cellRow = Math.floor(index / currentSize);
        const cellCol = index % currentSize;

        // Highlight row and column
        if (cellRow === row) {
            cell.classList.add('highlight-row');
        }
        if (cellCol === col) {
            cell.classList.add('highlight-col');
        }

        // Highlight the focused cell itself
        if (cellRow === row && cellCol === col) {
            cell.classList.add('focused');
        }
    });
    // Re-apply error feedback after general highlight
    applyErrorFeedback();
}

// Function to check if a number is valid in a specific cell (row, col)
function isValid(grid, row, col, num) {
    const size = grid.length;
    // Check row
    for (let x = 0; x < size; x++) {
        if (grid[row][x] === num && x !== col) {
            return false;
        }
    }

    // Check column
    for (let x = 0; x < size; x++) {
        if (grid[x][col] === num && x !== row) {
            return false;
        }
    }

    // Check box
    const boxSize = Math.sqrt(size);
    const startRow = row - (row % boxSize);
    const startCol = col - (col % boxSize);
    for (let i = 0; i < boxSize; i++) {
        for (let j = 0; j < boxSize; j++) {
            if (grid[i + startRow][j + startCol] === num && (i + startRow !== row || j + startCol !== col)) {
                return false;
            }
        }
    }
    return true;
}

// Function to apply error feedback to the grid
function applyErrorFeedback() {
    const allCells = sudokuGrid.querySelectorAll('.cell');
    allCells.forEach(cell => {
        cell.classList.remove('error-cell', 'error-row', 'error-col', 'error-block');
    });

    for (let r = 0; r < currentSize; r++) {
        for (let c = 0; c < currentSize; c++) {
            const num = currentPuzzle[r][c];
            if (num !== 0) {
                if (!isValid(currentPuzzle, r, c, num)) {
                    const cellIndex = r * currentSize + c;
                    const cellElement = allCells[cellIndex];
                    cellElement.classList.add('error-cell');

                    // Highlight conflicting row, column, and block
                    const boxSize = Math.sqrt(currentSize);
                    const startRow = r - (r % boxSize);
                    const startCol = c - (c % boxSize);

                    for (let i = 0; i < currentSize; i++) {
                        if (currentPuzzle[r][i] === num && i !== c) {
                            allCells[r * currentSize + i].classList.add('error-row');
                        }
                        if (currentPuzzle[i][c] === num && i !== r) {
                            allCells[i * currentSize + c].classList.add('error-col');
                        }
                    }

                    for (let i = 0; i < boxSize; i++) {
                        for (let j = 0; j < boxSize; j++) {
                            const cellRow = i + startRow;
                            const cellCol = j + startCol;
                            if (currentPuzzle[cellRow][cellCol] === num && (cellRow !== r || cellCol !== c)) {
                                allCells[cellRow * currentSize + cellCol].classList.add('error-block');
                            }
                        }
                    }
                }
            }
        }
    }
}

// Function to handle cell input
async function handleCellInput(event) {
    const input = event.target;
    const value = input.value;
    const row = parseInt(input.dataset.row);
    const col = parseInt(input.dataset.col);

    // Clear previous feedback specific to this input
    input.classList.remove('invalid-input');
    // Clear all error feedback and re-evaluate after change
    clearAllFeedback();

    if (value === '') {
        currentPuzzle[row][col] = 0;
    } else {
        const num = parseInt(value);
        const maxNum = currentSize;

        if (isNaN(num) || num < 1 || num > maxNum) {
            input.value = ''; // Clear invalid input
            currentPuzzle[row][col] = 0;
            input.classList.add('invalid-input');
        } else {
            currentPuzzle[row][col] = num; // Only store valid input
        }
    }

    // Save state after a valid input change
    saveState();

    // Re-apply highlights if cell is still focused
    if (focusedCell === input) {
        highlightRowAndColumn(row, col);
    }

    // Apply real-time error feedback
    applyErrorFeedback();

    // Check for game completion after every valid input
    checkGameCompletion();
}

// Function to render the Sudoku grid
function renderSudokuGrid(puzzleData) {
    sudokuGrid.innerHTML = ''; // Clear existing grid
    clearAllFeedback(); // Clear all feedback including highlights and errors

    currentPuzzle = JSON.parse(JSON.stringify(puzzleData.puzzle)); // Deep copy
    initialPuzzle = JSON.parse(JSON.stringify(puzzleData.puzzle)); // Store initial puzzle
    currentSize = puzzleData.size;

    // Set grid CSS classes based on size
    sudokuGrid.className = 'sudoku-grid'; // Reset first
    if (currentSize === 4) {
        sudokuGrid.classList.add('grid-4x4');
        sudokuGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    } else {
        sudokuGrid.classList.add('grid-9x9');
        sudokuGrid.style.gridTemplateColumns = 'repeat(9, 1fr)';
    }

    // Set dynamic cell size based on grid size for better aesthetics
    const cellSize = currentSize === 4 ? '60px' : '40px';
    document.documentElement.style.setProperty('--sudoku-cell-size', cellSize);

    initialPuzzle.forEach((row, rowIndex) => {
        row.forEach((num, colIndex) => {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            if (num !== 0) {
                cell.textContent = num;
                cell.classList.add('fixed');
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.dataset.row = rowIndex;
                input.dataset.col = colIndex;
                input.classList.add('user-input');
                input.addEventListener('input', handleCellInput);
                input.addEventListener('focus', (e) => {
                    const r = parseInt(e.target.dataset.row);
                    const c = parseInt(e.target.dataset.col);
                    highlightRowAndColumn(r, c);
                    focusedCell = e.target;
                });
                input.addEventListener('blur', () => {
                    if (focusedCell === event.target) {
                        clearAllFeedback(); // Clear all feedback on blur
                        focusedCell = null;
                    }
                });
                cell.appendChild(input);
            }
            sudokuGrid.appendChild(cell);
        });
    });
    startTimer(); // Start timer when puzzle is rendered
    saveState(); // Save initial state
}

// Function to check if the game is completed and valid
async function checkGameCompletion() {
    // First, check if all cells are filled
    const allCellsFilled = currentPuzzle.every(row => row.every(cell => cell !== 0));

    if (allCellsFilled) {
        // All cells are filled, now send to backend for validation
        try {
            const response = await fetch('/check_puzzle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ puzzle: currentPuzzle, size: currentSize }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.is_correct) {
                stopTimer();
                gameOverMessage.style.display = 'block'; // Show congratulations message
                completionSound.play(); // Play completion sound
                // Optionally disable inputs or show solved state
                sudokuGrid.querySelectorAll('.user-input').forEach(input => input.disabled = true);
                clearAllFeedback(); // Clear any error feedback on successful completion
            } else {
                // The puzzle is filled but incorrect
                // No alert, rely on real-time error feedback
                console.log('Puzzle is filled, but there are errors!');
                applyErrorFeedback(); // Ensure errors are visible if still present
            }
        } catch (error) {
            console.error('Error checking puzzle completion:', error);
            alert('An error occurred while checking the puzzle. Please try again.');
        }
    }
}

// Function to fetch a new puzzle from the backend
async function fetchNewPuzzle(difficulty = null, size = null) {
    const selectedSize = size || sizeSelect.value;
    const selectedDifficulty = difficulty || difficultySelect.value;

    try {
        const response = await fetch(`/generate_puzzle?size=${selectedSize}&difficulty=${selectedDifficulty}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
            alert('Error generating puzzle: ' + data.error);
            return;
        }
        renderSudokuGrid(data); // This will also call saveState()
        console.log('New puzzle generated:', data);
    } catch (error) {
        console.error('Failed to fetch new puzzle:', error);
        alert('Failed to fetch new puzzle. Please try again.');
    }
}

// Function to get the next difficulty level
function getNextDifficulty(currentDifficulty) {
    const difficulties = ['easy', 'medium', 'difficult'];
    const currentIndex = difficulties.indexOf(currentDifficulty);
    if (currentIndex < difficulties.length - 1) {
        return difficulties[currentIndex + 1];
    } else {
        return difficulties[0]; // Loop back to easy or keep difficult
    }
}

// Function to save the current game state
async function saveGame() {
    try {
        const response = await fetch('/save_game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                puzzle: currentPuzzle,
                time: seconds,
                difficulty: difficultySelect.value,
                size: currentSize
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        alert(`Game saved successfully! Your Game ID is: ${data.id}`);
        console.log('Game saved:', data);
    } catch (error) {
        console.error('Failed to save game:', error);
        alert('Failed to save game. Please try again.');
    }
}

// Function to load a game state
async function loadGame(gameId = null, loadedData = null) {
    let data;

    if (loadedData) {
        data = loadedData;
    } else {
        if (!gameId) {
            gameId = loadGameIdInput.value;
            if (!gameId) {
                alert('Please enter a Game ID to load.');
                return;
            }
        }

        try {
            const response = await fetch(`/load_game/${gameId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            data = await response.json();
            if (data.error) {
                alert('Error loading game: ' + data.error);
                return;
            }
        } catch (error) {
            console.error('Failed to load game:', error);
            alert('Failed to load game. Please try again.');
            return;
        }
    }

    sudokuGrid.innerHTML = ''; // Clear existing grid
    clearAllFeedback(); // Clear all feedback

    currentPuzzle = JSON.parse(JSON.stringify(data.puzzle)); // Deep copy
    initialPuzzle = JSON.parse(JSON.stringify(data.puzzle)); // Store initial puzzle
    currentSize = data.size;

    // Set grid CSS classes based on size
    sudokuGrid.className = 'sudoku-grid'; // Reset first
    if (currentSize === 4) {
        sudokuGrid.classList.add('grid-4x4');
        sudokuGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    } else {
        sudokuGrid.classList.add('grid-9x9');
        sudokuGrid.style.gridTemplateColumns = 'repeat(9, 1fr)';
    }

    // Set dynamic cell size based on grid size for better aesthetics
    const cellSize = currentSize === 4 ? '60px' : '40px';
    document.documentElement.style.setProperty('--sudoku-cell-size', cellSize);

    initialPuzzle.forEach((row, rowIndex) => {
        row.forEach((num, colIndex) => {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            if (num !== 0) {
                cell.textContent = num;
                cell.classList.add('fixed');
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.dataset.row = rowIndex;
                input.dataset.col = colIndex;
                input.classList.add('user-input');
                input.addEventListener('input', handleCellInput);
                input.addEventListener('focus', (e) => {
                    const r = parseInt(e.target.dataset.row);
                    const c = parseInt(e.target.dataset.col);
                    highlightRowAndColumn(r, c);
                    focusedCell = e.target;
                });
                input.addEventListener('blur', () => {
                    if (focusedCell === event.target) {
                        clearAllFeedback();
                        focusedCell = null;
                    }
                });
                cell.appendChild(input);
            }
            sudokuGrid.appendChild(cell);
        });
    });

    // Set timer to loaded time
    clearInterval(timerInterval); // Stop current timer
    seconds = data.time; // Set seconds to loaded time
    timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerDisplay.textContent =
            `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000); // Restart timer from loaded time

    // Update difficulty and size selectors to reflect loaded game
    sizeSelect.value = data.size === 4 ? '4x4' : '9x9';
    difficultySelect.value = data.difficulty;

    // Fill in user input cells with loaded values for currentPuzzle
    data.puzzle.forEach((row, rowIndex) => {
        row.forEach((num, colIndex) => {
            currentPuzzle[rowIndex][colIndex] = num;
        });
    });

    // Update display of input cells (currentPuzzle reflects state, initialPuzzle holds original)
    const userInputs = sudokuGrid.querySelectorAll('.user-input');
    userInputs.forEach(inputElement => {
        const r = parseInt(inputElement.dataset.row);
        const c = parseInt(inputElement.dataset.col);
        inputElement.value = currentPuzzle[r][c] === 0 ? '' : currentPuzzle[r][c];
    });

    if (!loadedData) { // Only show alert for manual load
        alert(`Game ID ${gameId} loaded successfully!`);
        console.log('Game loaded:', data);
    }
    applyErrorFeedback(); // Apply error feedback to loaded puzzle
    history = []; // Clear history for loaded game to start fresh tracking
    redoStack = [];
    saveState(); // Save the newly loaded state as the first history entry
}

// Function to handle Undo
function undo() {
    if (history.length > 1) { // Ensure there's at least one state to revert to
        const currentState = history.pop(); // Pop current state
        redoStack.push(currentState); // Push current state to redo
        const previousState = history[history.length - 1]; // Get the state to revert to
        loadGame(null, previousState); // Load the previous state without saving it again
        seconds = previousState.time; // Restore timer
        timerDisplay.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        updateUndoRedoButtons();
    } else {
        alert('No more moves to undo.');
    }
}

// Function to handle Redo
function redo() {
    if (redoStack.length > 0) {
        const nextState = redoStack.pop(); // Pop next state from redo
        history.push(nextState); // Push it to history
        loadGame(null, nextState); // Load this state
        seconds = nextState.time; // Restore timer
        timerDisplay.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        updateUndoRedoButtons();
    } else {
        alert('No more moves to redo.');
    }
}

// Function to get a hint from the backend
async function getHint() {
    try {
        const response = await fetch('/get_hint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ puzzle: currentPuzzle, size: currentSize }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            alert('Hint Error: ' + data.error);
        } else if (data.message) {
            alert(data.message);
        } else {
            const { row, col, value } = data;
            currentPuzzle[row][col] = value;

            const targetCellElement = sudokuGrid.querySelector(`.cell:nth-child(${row * currentSize + col + 1})`);
            if (targetCellElement) {
                const inputElement = targetCellElement.querySelector('input');
                if (inputElement) {
                    inputElement.value = value;
                    inputElement.classList.add('hint-highlight'); // Temporarily highlight hint
                    // Remove highlight after a short delay
                    setTimeout(() => {
                        inputElement.classList.remove('hint-highlight');
                    }, 1500);
                }
                // After applying hint, re-evaluate error feedback and save state
                saveState();
                applyErrorFeedback();
                checkGameCompletion(); // Check for completion after hint
            }
            alert(`Hint: Cell (${row + 1}, ${col + 1}) is ${value}`);
        }
    } catch (error) {
        console.error('Failed to get hint:', error);
        alert('Failed to get hint. Please try again.');
    }
}

// Event listeners
generateBtn.addEventListener('click', () => fetchNewPuzzle());
newGameBtn.addEventListener('click', () => fetchNewPuzzle());
saveGameBtn.addEventListener('click', saveGame);
loadGameBtn.addEventListener('click', () => loadGame());
hintBtn.addEventListener('click', getHint);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

nextLevelBtn.addEventListener('click', () => {
    const nextDifficulty = getNextDifficulty(difficultySelect.value);
    difficultySelect.value = nextDifficulty;
    fetchNewPuzzle();
});

// Initial puzzle load when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchNewPuzzle();
    updateUndoRedoButtons(); // Initialize button states
});

// Add CSS variable for cell size dynamically
const styleSheet = document.styleSheets[0];
// Check if :root rule exists, if not, insert it
const rootRuleIndex = Array.from(styleSheet.cssRules).findIndex(rule => rule.selectorText === ':root');
if (rootRuleIndex === -1) {
    styleSheet.insertRule(`:root { --sudoku-cell-size: 40px; }`, styleSheet.cssRules.length);
} else {
    // If it exists, update it (or ensure it's set correctly)
    // For simplicity, we just assume it's correctly set by previous steps or let new value override
}
