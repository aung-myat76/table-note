import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Save, Plus, Bold, Paintbrush } from "lucide-react";

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 6;
const DEFAULT_ROW_HEIGHT = 40;
const DEFAULT_COL_WIDTH = 120;

const makeCell = () => ({
    text: "",
    bold: false,
    textColor: "#0f172a",
    bgColor: "#ffffff",
});

const makeGrid = (rows, cols) =>
    Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => makeCell())
    );

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

    // --- Column Resize ---
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

    // --- Update Cell with Auto-Fit ---
    const updateCell = (r, c, updates) => {
        setGrid((prev) => {
            const copy = prev.map((row) => row.slice());
            copy[r][c] = { ...copy[r][c], ...updates };
            return copy;
        });

        if (updates.text !== undefined) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            const style = window.getComputedStyle(document.body);
            context.font = `${grid[r][c].bold ? "bold " : ""}16px ${
                style.fontFamily
            }`;
            const textWidth = context.measureText(updates.text).width + 30;

            setColWidths((prev) => {
                const newWidths = [...prev];
                if (textWidth > newWidths[c]) newWidths[c] = textWidth;
                else if (textWidth < DEFAULT_COL_WIDTH)
                    newWidths[c] = DEFAULT_COL_WIDTH;
                return newWidths;
            });
        }
    };

    // --- Add Row / Column ---
    const addRow = () => {
        setGrid((prev) => [
            ...prev,
            Array.from({ length: cols }, () => makeCell()),
        ]);
        setRowHeights((prev) => [...prev, DEFAULT_ROW_HEIGHT]);
        setRows((r) => r + 1);
    };

    const addCol = () => {
        setGrid((prev) => prev.map((row) => [...row, makeCell()]));
        setColWidths((prev) => [...prev, DEFAULT_COL_WIDTH]);
        setCols((c) => c + 1);
    };

    // --- Copy / Apply Format ---
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

    // --- Export Image (header + content only) ---
    const exportImage = async () => {
        if (!tableRef.current) return;

        const exportDiv = document.createElement("div");
        exportDiv.style.display = "inline-block";
        exportDiv.style.border = "1px solid #ccc";
        exportDiv.style.padding = "10px";
        exportDiv.style.background = "white";

        // Header
        const headerDiv = document.createElement("div");
        headerDiv.style.fontWeight = "bold";
        headerDiv.style.fontSize = "16px";
        headerDiv.style.marginBottom = "10px";
        headerDiv.innerText = initialHeader;
        exportDiv.appendChild(headerDiv);

        // Only include rows with content
        const filteredRows = grid.filter((row) =>
            row.some((cell) => cell.text.trim() !== "")
        );
        const hasContentCol = Array.from({ length: cols }).map((_, c) =>
            filteredRows.some((row) => row[c]?.text.trim() !== "")
        );

        filteredRows.forEach((row, rIdx) => {
            const rowDiv = document.createElement("div");
            rowDiv.style.display = "flex";
            row.forEach((cell, cIdx) => {
                if (!hasContentCol[cIdx]) return;
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
                cellDiv.innerText = cell.text;
                rowDiv.appendChild(cellDiv);
            });
            exportDiv.appendChild(rowDiv);
        });

        document.body.appendChild(exportDiv);
        const dataUrl = await toPng(exportDiv);
        const link = document.createElement("a");
        link.download = "table.png";
        link.href = dataUrl;
        link.click();
        document.body.removeChild(exportDiv);
    };

    // --- Daily Breakage Button ---
    const addDailyBreakage = () => {
        if (cols < 4) {
            for (let i = 0; i < 4 - cols; i++) addCol();
        }

        setGrid((prev) => {
            const newGrid = prev.map((row) => row.slice());

            // Header row
            const headerRow = [
                {
                    text: "Items",
                    bold: true,
                    textColor: "#ffffff",
                    bgColor: "#3b82f6",
                },
                {
                    text: "Get",
                    bold: true,
                    textColor: "#ffffff",
                    bgColor: "#3b82f6",
                },
                {
                    text: "Lost",
                    bold: true,
                    textColor: "#ffffff",
                    bgColor: "#3b82f6",
                },
                {
                    text: "Total",
                    bold: true,
                    textColor: "#ffffff",
                    bgColor: "#3b82f6",
                },
            ];

            newGrid[0] = headerRow.concat(newGrid[0].slice(4));

            // MB Qt rows under Items
            let tempGrid = [...newGrid];
            tempGrid.splice(
                1,
                0,
                Array.from({ length: cols }, () => makeCell())
            );
            tempGrid.splice(
                2,
                0,
                Array.from({ length: cols }, () => makeCell())
            );
            tempGrid[1][0].text = "MB Qt (Pro)";
            tempGrid[2][0].text = "MB Qt (N)";

            return tempGrid;
        });

        setRowHeights((prev) => {
            const newHeights = [...prev];
            newHeights.splice(1, 0, DEFAULT_ROW_HEIGHT);
            newHeights.splice(2, 0, DEFAULT_ROW_HEIGHT);
            return newHeights;
        });

        setRows((prev) => prev + 2);
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
                            className="w-full  focus:outline-0"
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
                                            className="w-full h-full bg-transparent text-center outline-none"
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
