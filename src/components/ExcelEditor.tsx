
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CellFormatting {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  bgColor?: string;
  wrap?: boolean;
}

interface CellData extends CellFormatting {
  value: string; 
  computed?: string; 
}

interface MergeRange {
  sr: number; // start row
  sc: number; // start col
  er: number; // end row
  ec: number; // end col
}

interface GridState {
  data: CellData[][];
  colWidths: number[];
  rowHeights: number[];
  merges: MergeRange[];
}

interface Props {
  initialTitle: string;
  initialData: string;
  onSave: (title: string, data: string) => Promise<void>;
  onClose: () => void;
  isVaultMounted: boolean;
  onMountVault?: () => void;
}

const INITIAL_ROWS = 50;
const INITIAL_COLS = 26;
const DEFAULT_COL_WIDTH = 120;
const DEFAULT_ROW_HEIGHT = 32;

const ExcelEditor: React.FC<Props> = ({ initialTitle, initialData, onSave, onClose }) => {
  const [title, setTitle] = useState(initialTitle);
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [merges, setMerges] = useState<MergeRange[]>([]);
  
  const [selection, setSelection] = useState<{ sr: number, sc: number, er: number, ec: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  const [resizing, setResizing] = useState<{ type: 'col' | 'row', index: number, startPos: number, startSize: number } | null>(null);
  
  const [activeTab, setActiveTab] = useState<'home' | 'formulas'>('home');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize/Load Grid
  useEffect(() => {
    try {
      if (initialData && initialData !== "{}") {
        const parsed = JSON.parse(initialData);
        if (parsed.grid || Array.isArray(parsed)) {
          const gridData = Array.isArray(parsed) ? parsed : (parsed.grid || []);
          setGrid(gridData);
          setColWidths(parsed.colWidths || Array(gridData[0]?.length || INITIAL_COLS).fill(DEFAULT_COL_WIDTH));
          setRowHeights(parsed.rowHeights || Array(gridData.length || INITIAL_ROWS).fill(DEFAULT_ROW_HEIGHT));
          setMerges(parsed.merges || []);
        }
      } else {
        const emptyGrid = Array(INITIAL_ROWS).fill(null).map(() => 
          Array(INITIAL_COLS).fill(null).map(() => ({ value: '' }))
        );
        setGrid(emptyGrid);
        setColWidths(Array(INITIAL_COLS).fill(DEFAULT_COL_WIDTH));
        setRowHeights(Array(INITIAL_ROWS).fill(DEFAULT_ROW_HEIGHT));
      }
    } catch (e) {
      const emptyGrid = Array(INITIAL_ROWS).fill(null).map(() => 
        Array(INITIAL_COLS).fill(null).map(() => ({ value: '' }))
      );
      setGrid(emptyGrid);
      setColWidths(Array(INITIAL_COLS).fill(DEFAULT_COL_WIDTH));
      setRowHeights(Array(INITIAL_ROWS).fill(DEFAULT_ROW_HEIGHT));
    }
  }, [initialData]);

  const getColLabel = (index: number) => {
    let label = "";
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode((i % 26) + 65) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  const parseCoord = (coord: string) => {
    const match = coord.match(/([A-Z]+)(\d+)/);
    if (!match) return null;
    const colStr = match[1];
    const row = parseInt(match[2]) - 1;
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { r: row, c: col - 1 };
  };

  const evaluateFormula = useCallback((formula: string, currentGrid: CellData[][]): string => {
    if (!formula.startsWith('=')) return formula;
    const expression = formula.substring(1).toUpperCase();
    try {
      const rangeRegex = /([A-Z]+\d+):([A-Z]+\d+)/g;
      const getRangeValues = (match: string, start: string, end: string) => {
        const s = parseCoord(start);
        const e = parseCoord(end);
        if (!s || !e) return [];
        const values = [];
        for (let r = Math.min(s.r, e.r); r <= Math.max(s.r, e.r); r++) {
          for (let c = Math.min(s.c, e.c); c <= Math.max(s.c, e.c); c++) {
            const val = parseFloat(currentGrid[r]?.[c]?.computed || currentGrid[r]?.[c]?.value || "0");
            values.push(isNaN(val) ? 0 : val);
          }
        }
        return values;
      };
      const evalString = expression.replace(rangeRegex, (match, start, end) => {
        const vals = getRangeValues(match, start, end);
        return `[${vals.join(',')}]`;
      });
      const cellRegex = /\b([A-Z]+\d+)\b(?!\()/g;
      const finalEval = evalString.replace(cellRegex, (match) => {
        const coord = parseCoord(match);
        if (!coord) return "0";
        const val = parseFloat(currentGrid[coord.r]?.[coord.c]?.computed || currentGrid[coord.r]?.[coord.c]?.value || "0");
        return isNaN(val) ? "0" : val.toString();
      });
      const SUM = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
      const AVERAGE = (arr: number[]) => SUM(arr) / arr.length;
      const sandbox = { SUM, AVERAGE };
      return new Function(...Object.keys(sandbox), `return ${finalEval}`)(...Object.values(sandbox)).toString();
    } catch (err) {
      return "#VALUE!";
    }
  }, []);

  const updateGridRange = (updates: Partial<CellData>) => {
    if (!selection) return;
    const { sr, sc, er, ec } = selection;
    const startR = Math.min(sr, er);
    const endR = Math.max(sr, er);
    const startC = Math.min(sc, ec);
    const endC = Math.max(sc, ec);

    const newGrid = grid.map((row, r) => {
      if (r < startR || r > endR) return row;
      return row.map((cell, c) => {
        if (c < startC || c > endC) return cell;
        return { ...cell, ...updates };
      });
    });

    // Recompute formulas
    const finalGrid = newGrid.map((row) => row.map((cell) => {
      if (cell.value.startsWith('=')) {
        return { ...cell, computed: evaluateFormula(cell.value, newGrid) };
      }
      return { ...cell, computed: cell.value };
    }));

    setGrid(finalGrid);
  };

  const mergeSelection = () => {
    if (!selection) return;
    const { sr, sc, er, ec } = selection;
    const startR = Math.min(sr, er);
    const endR = Math.max(sr, er);
    const startC = Math.min(sc, ec);
    const endC = Math.max(sc, ec);

    if (startR === endR && startC === endC) return; // Cannot merge single cell

    const newMerge: MergeRange = { sr: startR, sc: startC, er: endR, ec: endC };
    setMerges([...merges, newMerge]);
  };

  const unmergeSelection = () => {
    if (!selection) return;
    const { sr, sc, er, ec } = selection;
    const startR = Math.min(sr, er);
    const endR = Math.max(sr, er);
    const startC = Math.min(sc, ec);
    const endC = Math.max(sc, ec);

    setMerges(merges.filter(m => !(m.sr === startR && m.sc === startC && m.er === endR && m.ec === endC)));
  };

  const handleMouseDown = (r: number, c: number) => {
    setIsSelecting(true);
    setSelection({ sr: r, sc: c, er: r, ec: c });
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (isSelecting && selection) {
      setSelection({ ...selection, er: r, ec: c });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    setResizing(null);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent, type: 'col' | 'row', index: number) => {
    e.stopPropagation();
    const startPos = type === 'col' ? e.clientX : e.clientY;
    const startSize = type === 'col' ? colWidths[index] : rowHeights[index];
    setResizing({ type, index, startPos, startSize });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (resizing) {
      const { type, index, startPos, startSize } = resizing;
      const currentPos = type === 'col' ? e.clientX : e.clientY;
      const delta = currentPos - startPos;
      const newSize = Math.max(30, startSize + delta);

      if (type === 'col') {
        const newWidths = [...colWidths];
        newWidths[index] = newSize;
        setColWidths(newWidths);
      } else {
        const newHeights = [...rowHeights];
        newHeights[index] = newSize;
        setRowHeights(newHeights);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        grid, colWidths, rowHeights, merges
      };
      await onSave(title, JSON.stringify(dataToSave));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
    }
  };

  const isCellHidden = (r: number, c: number) => {
    return merges.some(m => 
      r >= m.sr && r <= m.er && c >= m.sc && c <= m.ec && (r !== m.sr || c !== m.sc)
    );
  };

  const getMergeInfo = (r: number, c: number) => {
    const merge = merges.find(m => m.sr === r && m.sc === c);
    if (!merge) return { rowSpan: 1, colSpan: 1 };
    return {
      rowSpan: merge.er - merge.sr + 1,
      colSpan: merge.ec - merge.sc + 1
    };
  };

  if (grid.length === 0) return (
    <div className="fixed inset-0 z-[250] bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
    </div>
  );

  const activeCell = selection ? grid[selection.sr][selection.sc] : null;

  return (
    <div 
      className="fixed inset-0 z-[250] bg-slate-100 flex flex-col animate-in fade-in duration-300 overflow-hidden text-slate-900 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* RIBBON */}
      <div className="w-full bg-white border-b border-slate-300 shadow-sm shrink-0">
        <div className="px-6 py-2 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-600 rounded-lg shadow-lg">
              <i className="fas fa-file-excel text-white text-lg"></i>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Cell Matrix Pro</span>
            </div>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-700 text-sm w-64 focus:ring-2 focus:ring-emerald-500 rounded px-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md transition flex items-center gap-2 ${isSaving ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
            >
              {isSaving ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-floppy-disk"></i>}
              {isSaving ? 'Saving...' : 'Save Matrix'}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 transition-colors">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div className="flex px-6 border-b border-slate-100 bg-white">
          {(['home', 'formulas'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-emerald-500 text-emerald-600 bg-emerald-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="px-6 py-3 flex items-center gap-8 bg-white/50 h-16">
          {activeTab === 'home' && (
            <div className="flex items-center gap-4">
              <button onClick={() => updateGridRange({ bold: !activeCell?.bold })} className={`w-10 h-10 rounded flex items-center justify-center border ${activeCell?.bold ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><i className="fas fa-bold"></i></button>
              <button onClick={() => updateGridRange({ italic: !activeCell?.italic })} className={`w-10 h-10 rounded flex items-center justify-center border ${activeCell?.italic ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><i className="fas fa-italic"></i></button>
              <div className="w-px h-8 bg-slate-200"></div>
              <button onClick={() => updateGridRange({ align: 'left' })} className={`w-8 h-8 rounded ${activeCell?.align === 'left' ? 'bg-slate-200' : 'hover:bg-slate-100'} text-slate-500`}><i className="fas fa-align-left"></i></button>
              <button onClick={() => updateGridRange({ align: 'center' })} className={`w-8 h-8 rounded ${activeCell?.align === 'center' ? 'bg-slate-200' : 'hover:bg-slate-100'} text-slate-500`}><i className="fas fa-align-center"></i></button>
              <button onClick={() => updateGridRange({ align: 'right' })} className={`w-8 h-8 rounded ${activeCell?.align === 'right' ? 'bg-slate-200' : 'hover:bg-slate-100'} text-slate-500`}><i className="fas fa-align-right"></i></button>
              <div className="w-px h-8 bg-slate-200"></div>
              <button onClick={() => updateGridRange({ wrap: !activeCell?.wrap })} className={`px-3 py-1.5 rounded flex items-center gap-2 border text-[9px] font-black uppercase tracking-widest ${activeCell?.wrap ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}><i className="fas fa-text-width"></i> Wrap</button>
              <button onClick={mergeSelection} className="px-3 py-1.5 rounded flex items-center gap-2 border bg-white border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50"><i className="fas fa-object-group"></i> Merge</button>
              <button onClick={unmergeSelection} className="px-3 py-1.5 rounded flex items-center gap-2 border bg-white border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50"><i className="fas fa-object-ungroup"></i> Unmerge</button>
            </div>
          )}
          {activeTab === 'formulas' && (
            <div className="flex items-center gap-4">
               <button onClick={() => updateGridRange({ value: '=SUM(A1:A10)' })} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase border border-emerald-200 hover:bg-emerald-100">Sum Range</button>
               <button onClick={() => updateGridRange({ value: '=AVERAGE(A1:A10)' })} className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase border border-emerald-200 hover:bg-emerald-100">Average Range</button>
            </div>
          )}
        </div>
      </div>

      {/* FORMULA BAR */}
      <div className="w-full bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-3">
        <div className="bg-white border border-slate-300 rounded px-4 py-1.5 text-[11px] font-black text-slate-600 min-w-[70px] text-center shadow-sm">
          {selection ? `${getColLabel(selection.sc)}${selection.sr + 1}` : '--'}
        </div>
        <div className="flex-1 bg-white border border-slate-300 rounded-lg px-4 flex items-center shadow-sm focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
          <span className="italic text-slate-300 font-serif mr-3 text-lg font-bold">fx</span>
          <input 
            type="text"
            className="w-full py-2 text-sm font-medium outline-none text-slate-700"
            value={selection ? grid[selection.sr][selection.sc].value : ''}
            onChange={(e) => updateGridRange({ value: e.target.value })}
            placeholder="Enter formula or value..."
          />
        </div>
      </div>

      {/* GRID CONTAINER */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-200 p-1">
        <div className="inline-block">
          <table className="border-collapse table-fixed bg-white shadow-lg">
            <thead>
              <tr className="bg-slate-100">
                <th className="w-12 border border-slate-300 sticky left-0 top-0 z-40 bg-slate-100"></th>
                {grid[0]?.map((_, c) => (
                  <th 
                    key={c} 
                    style={{ width: colWidths[c] }}
                    className="h-8 border border-slate-300 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 z-30 bg-slate-100 group relative"
                  >
                    {getColLabel(c)}
                    <div 
                      onMouseDown={(e) => handleHeaderMouseDown(e, 'col', c)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-400 z-50"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r} style={{ height: rowHeights[r] }}>
                  <td className="w-12 border border-slate-300 bg-slate-100 text-[10px] font-black text-slate-400 text-center sticky left-0 z-20 group relative">
                    {r + 1}
                    <div 
                      onMouseDown={(e) => handleHeaderMouseDown(e, 'row', r)}
                      className="absolute left-0 right-0 bottom-0 h-1.5 cursor-row-resize hover:bg-emerald-400 z-50"
                    />
                  </td>
                  {row.map((cell, c) => {
                    if (isCellHidden(r, c)) return null;
                    const { rowSpan, colSpan } = getMergeInfo(r, c);
                    
                    const isSelected = selection && (
                      r >= Math.min(selection.sr, selection.er) && 
                      r <= Math.max(selection.sr, selection.er) &&
                      c >= Math.min(selection.sc, selection.ec) &&
                      c <= Math.max(selection.sc, selection.ec)
                    );

                    const isActive = selection && selection.sr === r && selection.sc === c;

                    return (
                      <td 
                        key={c}
                        rowSpan={rowSpan}
                        colSpan={colSpan}
                        onMouseDown={() => handleMouseDown(r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        className={`border border-slate-200 relative p-0 overflow-hidden ${isSelected ? 'bg-emerald-50/50' : ''}`}
                        style={{
                          textAlign: cell.align || 'left',
                          fontWeight: cell.bold ? '900' : 'normal',
                          fontStyle: cell.italic ? 'italic' : 'normal',
                          backgroundColor: cell.bgColor,
                          verticalAlign: 'top'
                        }}
                      >
                        {isActive ? (
                          <textarea 
                            autoFocus
                            className={`w-full h-full p-2 text-[13px] outline-none bg-white font-medium text-slate-800 resize-none ${cell.wrap ? 'whitespace-pre-wrap' : 'whitespace-nowrap overflow-hidden'}`}
                            value={cell.value}
                            onChange={(e) => updateGridRange({ value: e.target.value })}
                          />
                        ) : (
                          <div className={`w-full h-full p-2 text-[13px] font-medium text-slate-800 ${cell.wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>
                            {cell.computed || cell.value}
                          </div>
                        )}
                        {isSelected && !isActive && <div className="absolute inset-0 ring-1 ring-emerald-500/30 pointer-events-none" />}
                        {isActive && <div className="absolute inset-0 ring-2 ring-emerald-500 z-10 pointer-events-none" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <div className="w-full bg-emerald-700 text-white h-8 flex items-center justify-between px-6 text-[10px] font-bold z-40 shrink-0">
         <div className="flex items-center gap-6">
            <span>Spreadsheet Mode</span>
            <span>Rows: {grid.length} | Cols: {grid[0]?.length} | Merges: {merges.length}</span>
         </div>
         <div className="flex items-center gap-4">
            {saveSuccess && <span className="animate-in slide-in-from-right-4">SAVED TO VAULT</span>}
            <span className="opacity-50">Cell Matrix v1.4 • Drag borders to resize</span>
         </div>
      </div>
    </div>
  );
};

export default ExcelEditor;
