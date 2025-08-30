import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Save, Plus, Bold, Paintbrush } from "lucide-react";
import { produce } from "immer";

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 6;
const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_COL_WIDTH = 120;

// Create a default cell object
const makeCell = () => ({
    text: "",
    bold: false,
    textColor: "#0f172a",
    bgColor: "#ffffff",
});

// Create a grid of cells
const makeGrid = (rows, cols) =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => makeCell())
    );

// Generate initial header text
function getShiftLabel() {
    const now = new Date();
    const hours = now.getHours();
    const date = `${String(now.getDate()).padStart(2, "0")}.${String(
        now.getMonth() + 1
    ).padStart(2, "0")}.${now.getFullYear()}`;
    const shift =
        hours >= 6 && hours < 18 ? "(Morning Shift)" : "(Night Shift)";
    return `${date} - Daily Breakage - ${shift}`;
}

// Helper to measure text width for autofit
const measureTextWidth = (text, font = "14px Arial") => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = font;
    return ctx.measureText(text).width + 20; // padding
};

export default function TableNotesExcelUI() {
    const [initialHeader, setInitialHeader] = useState(getShiftLabel());
    const [rows, setRows] = useState(DEFAULT_ROWS);
    const [cols, setCols] = useState(DEFAULT_COLS);
    const [grid, setGrid] = useState(() =>
        makeGrid(DEFAULT_ROWS, DEFAULT_COLS)
    );
    const [rowHeights, setRowHeights] = useState(
        Array.from({ length: DEFAULT_ROWS }, () => DEFAULT_ROW_HEIGHT)
    );
    const [colWidths, setColWidths] = useState(
        Array.from({ length: DEFAULT_COLS }, () => DEFAULT_COL_WIDTH)
    );
    const [activeCell, setActiveCell] = useState(null);
    const [formatClipboard, setFormatClipboard] = useState(null);
    const tableRef = useRef(null);

    // Undo / Redo
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);

    const pushToHistory = () => {
        setHistory((prev) => [
            ...prev,
            { grid, rows, cols, rowHeights, colWidths, initialHeader },
        ]);
        setFuture([]);
    };

    const undo = () => {
        if (!history.length) return;
        const prevState = history[history.length - 1];
        setHistory((prev) => prev.slice(0, prev.length - 1));
        setFuture((prev) => [
            ...prev,
            { grid, rows, cols, rowHeights, colWidths, initialHeader },
        ]);
        setGrid(prevState.grid);
        setRows(prevState.rows);
        setCols(prevState.cols);
        setRowHeights(prevState.rowHeights);
        setColWidths(prevState.colWidths);
        setInitialHeader(prevState.initialHeader);
    };

    const redo = () => {
        if (!future.length) return;
        const nextState = future[future.length - 1];
        setFuture((prev) => prev.slice(0, prev.length - 1));
        setHistory((prev) => [
            ...prev,
            { grid, rows, cols, rowHeights, colWidths, initialHeader },
        ]);
        setGrid(nextState.grid);
        setRows(nextState.rows);
        setCols(nextState.cols);
        setRowHeights(nextState.rowHeights);
        setColWidths(nextState.colWidths);
        setInitialHeader(nextState.initialHeader);
    };

    // Daily Breakage
    const addDailyBreakage = () => {
        pushToHistory();
        if (cols < 4) {
            for (let i = 0; i < 4 - cols; i++) addCol();
        }
        setGrid((prev) =>
            produce(prev, (draft) => {
                const headerRow = [
                    {
                        text: "Items",
                        bold: true,
                        textColor: "#fff",
                        bgColor: "#3b82f6",
                    },
                    {
                        text: "Get",
                        bold: true,
                        textColor: "#fff",
                        bgColor: "#3b82f6",
                    },
                    {
                        text: "Lost",
                        bold: true,
                        textColor: "#fff",
                        bgColor: "#3b82f6",
                    },
                    {
                        text: "Total",
                        bold: true,
                        textColor: "#fff",
                        bgColor: "#3b82f6",
                    },
                ];
                draft[0] = headerRow.concat(draft[0].slice(4));

                draft.splice(
                    1,
                    0,
                    Array.from({ length: cols }, () => makeCell())
                );
                draft.splice(
                    2,
                    0,
                    Array.from({ length: cols }, () => makeCell())
                );

                draft[1][0].text = "MB Qt (Pro)";
                draft[2][0].text = "MB Qt (N)";
            })
        );

        setRowHeights((prev) => {
            const newHeights = [...prev];
            newHeights.splice(1, 0, DEFAULT_ROW_HEIGHT);
            newHeights.splice(2, 0, DEFAULT_ROW_HEIGHT);
            return newHeights;
        });
        setRows((prev) => prev + 2);
    };

    // Column Resize
    const startColResize = (e, colIndex) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = colWidths[colIndex];
        const onMouseMove = (moveEvent) => {
            const diff = moveEvent.clientX - startX;
            setColWidths((prev) => {
                const newWidths = [...prev];
                newWidths[colIndex] = Math.max(50, startWidth + diff);
                return newWidths;
            });
        };
        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    };

    // Update cell and auto-fit column (expand + shrink)
    const updateCell = (r, c, updates) => {
        pushToHistory();
        setGrid((prev) =>
            produce(prev, (draft) => {
                draft[r][c] = { ...draft[r][c], ...updates };
            })
        );

        // Auto-fit column width
        setTimeout(() => {
            const colMaxWidth = Math.max(
                50,
                ...grid.map((row) => {
                    const text = row[c].text || "";
                    return Math.min(400, text.length * 12 + 20); // Approximate width
                })
            );
            setColWidths((prev) => {
                const newWidths = [...prev];
                newWidths[c] = colMaxWidth;
                return newWidths;
            });
        }, 0);
    };

    // Add row / col
    const addRow = () => {
        pushToHistory();
        setGrid((prev) =>
            produce(prev, (draft) =>
                draft.push(Array.from({ length: cols }, () => makeCell()))
            )
        );
        setRowHeights((prev) => [...prev, DEFAULT_ROW_HEIGHT]);
        setRows((r) => r + 1);
    };

    const addCol = () => {
        pushToHistory();
        setGrid((prev) =>
            produce(prev, (draft) =>
                draft.forEach((row) => row.push(makeCell()))
            )
        );
        setColWidths((prev) => [...prev, DEFAULT_COL_WIDTH]);
        setCols((c) => c + 1);
    };

    // Copy / Apply Format
    const copyFormat = () => {
        if (!activeCell) return;
        setFormatClipboard({ ...grid[activeCell.r][activeCell.c] });
    };

    const applyFormat = (r, c) => {
        if (!formatClipboard) return;
        const { bold, textColor, bgColor } = formatClipboard;
        updateCell(r, c, { bold, textColor, bgColor });
        setFormatClipboard(null);
    };

    // Export PNG
    const exportImage = async () => {
        if (!tableRef.current) return;

        try {
            // Clone table for export
            const exportDiv = document.createElement("div");
            exportDiv.style.display = "inline-block";
            exportDiv.style.background = "white";
            exportDiv.style.padding = "10px";
            exportDiv.style.border = "1px solid #ccc";

            // Header
            const headerDiv = document.createElement("div");
            headerDiv.style.fontWeight = "bold";
            headerDiv.style.fontSize = "16px";
            headerDiv.style.marginBottom = "10px";
            headerDiv.innerText = initialHeader;
            exportDiv.appendChild(headerDiv);

            // Only keep rows that have content
            const filteredRows = grid.filter((row) =>
                row.some((cell) => cell.text.trim() !== "")
            );

            // Determine which columns have content
            const usedCols = Array.from({ length: cols }).map((_, c) =>
                filteredRows.some((row) => row[c]?.text.trim() !== "")
            );

            filteredRows.forEach((row, rIdx) => {
                const rowDiv = document.createElement("div");
                rowDiv.style.display = "flex";

                row.forEach((cell, cIdx) => {
                    if (!usedCols[cIdx]) return; // skip empty column

                    const cellDiv = document.createElement("div");
                    cellDiv.style.width = colWidths[cIdx] + "px";
                    cellDiv.style.height = rowHeights[rIdx] + "px";
                    cellDiv.style.border = "1px solid #ccc";
                    cellDiv.style.display = "flex";
                    cellDiv.style.alignItems = "center";
                    cellDiv.style.justifyContent = "center";
                    cellDiv.style.background = cell.bgColor;
                    cellDiv.style.color = cell.textColor;
                    cellDiv.style.fontWeight = cell.bold ? "bold" : "normal";

                    // Only put text if the cell has it
                    cellDiv.innerText = cell.text;

                    rowDiv.appendChild(cellDiv);
                });

                exportDiv.appendChild(rowDiv);
            });

            document.body.appendChild(exportDiv);
            const dataUrl = await toPng(exportDiv, { cacheBust: true });
            const link = document.createElement("a");
            link.download = "table.png";
            link.href = dataUrl;
            link.click();
            document.body.removeChild(exportDiv);
        } catch (err) {
            console.error("Export failed:", err);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-2 bg-white shadow">
                <button
                    onClick={addRow}
                    className="px-2 py-1 border rounded flex items-center gap-1"
                >
                    <Plus size={14} /> Row
                </button>
                <button
                    onClick={addCol}
                    className="px-2 py-1 border rounded flex items-center gap-1"
                >
                    <Plus size={14} /> Col
                </button>
                <button
                    onClick={exportImage}
                    className="px-2 py-1 border rounded flex items-center gap-1"
                >
                    <Save size={14} /> PNG
                </button>
                <button
                    onClick={addDailyBreakage}
                    className="px-2 py-1 border rounded flex items-center gap-1 bg-blue-500 text-white"
                >
                    Daily Breakage
                </button>
                <button
                    onClick={undo}
                    disabled={history.length === 0}
                    className="px-2 py-1 border rounded flex items-center gap-1"
                >
                    Undo
                </button>
                <button
                    onClick={redo}
                    disabled={future.length === 0}
                    className="px-2 py-1 border rounded flex items-center gap-1"
                >
                    Redo
                </button>

                {activeCell && (
                    <div className="flex items-center gap-2 ml-4">
                        <button
                            onClick={() =>
                                updateCell(activeCell.r, activeCell.c, {
                                    bold: !grid[activeCell.r][activeCell.c]
                                        .bold,
                                })
                            }
                            className="px-2 py-1 border rounded"
                        >
                            <Bold size={14} />
                        </button>
                        <input
                            type="color"
                            value={grid[activeCell.r][activeCell.c].textColor}
                            onChange={(e) =>
                                updateCell(activeCell.r, activeCell.c, {
                                    textColor: e.target.value,
                                })
                            }
                        />
                        <input
                            type="color"
                            value={grid[activeCell.r][activeCell.c].bgColor}
                            onChange={(e) =>
                                updateCell(activeCell.r, activeCell.c, {
                                    bgColor: e.target.value,
                                })
                            }
                        />
                        <button
                            onClick={copyFormat}
                            className="px-2 py-1 border rounded flex items-center gap-1"
                        >
                            <Paintbrush size={14} /> Copy Format
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 p-4">
                <div ref={tableRef} className="inline-block min-w-max">
                    <div className="font-bold text-lg mb-2">
                        <input
                            className="w-full focus:outline-0"
                            value={initialHeader}
                            onChange={(e) => setInitialHeader(e.target.value)}
                        />
                    </div>
                    <div className="border">
                        {grid.map((row, rIdx) => (
                            <div key={rIdx} className="flex w-full">
                                {row.map((cell, cIdx) => (
                                    <div
                                        key={cIdx}
                                        style={{
                                            width: colWidths[cIdx],
                                            height: rowHeights[rIdx],
                                            backgroundColor: cell.bgColor,
                                            color: cell.textColor,
                                            fontWeight: cell.bold
                                                ? "bold"
                                                : "normal",
                                            position: "relative",
                                        }}
                                        className="border flex items-center justify-center"
                                        onClick={() => {
                                            if (formatClipboard)
                                                applyFormat(rIdx, cIdx);
                                            else
                                                setActiveCell({
                                                    r: rIdx,
                                                    c: cIdx,
                                                });
                                        }}
                                    >
                                        <input
                                            value={cell.text}
                                            onChange={(e) =>
                                                updateCell(rIdx, cIdx, {
                                                    text: e.target.value,
                                                })
                                            }
                                            className="h-full bg-transparent text-center outline-none"
                                            style={{ width: "100%" }}
                                        />
                                        <div
                                            onMouseDown={(e) =>
                                                startColResize(e, cIdx)
                                            }
                                            style={{
                                                position: "absolute",
                                                top: 0,
                                                right: 0,
                                                width: "5px",
                                                height: "100%",
                                                cursor: "col-resize",
                                                zIndex: 10,
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
