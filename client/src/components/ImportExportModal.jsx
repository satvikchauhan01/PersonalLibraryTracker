import React, { useState } from 'react';
import {
  X,
  Upload,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { importBooks, downloadExport } from '../services/importExportService';
import { parseImportFile } from '../utils/importParsers';

const TABS = [
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'export', label: 'Export', icon: Download },
];

const ImportExportModal = ({ onClose, onImported }) => {
  const [activeTab, setActiveTab] = useState('import');

  // Export state
  const [exporting, setExporting] = useState(null); // 'json' | 'csv' | null

  // Import state
  const [parsed, setParsed] = useState(null); // { rows, droppedCount, fileName }
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { added, skipped, errors }

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await downloadExport(format);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setParseError('');
    setParsed(null);
    setResult(null);

    try {
      const { rows, droppedCount } = await parseImportFile(file);
      if (rows.length === 0) {
        setParseError('No importable rows found — check the file has Title and Author columns.');
        return;
      }
      setParsed({ rows, droppedCount, fileName: file.name });
    } catch (err) {
      setParseError('Could not read that file. Make sure it is a valid .csv or .json export.');
      console.error('Parse failed:', err);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const { data } = await importBooks(parsed.rows);
      setResult(data);
      if (data.added > 0) onImported?.();
    } catch (err) {
      setResult({
        added: 0,
        skipped: 0,
        errors: [{ message: err.response?.data?.message || 'Import failed. Please try again.' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setParsed(null);
    setParseError('');
    setResult(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-start flex-shrink-0">
          <div>
            <h2 className="text-white text-lg font-bold">Import / Export</h2>
            <p className="text-indigo-100 text-sm mt-0.5">
              Bring books in, or take your library out.
            </p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow">
          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Download your full library — every book, plus ratings, tags, reviews and shelf
                membership.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting !== null}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors disabled:opacity-50"
                >
                  {exporting === 'json' ? (
                    <Loader size={24} className="animate-spin text-indigo-500" />
                  ) : (
                    <FileJson size={24} className="text-indigo-500" />
                  )}
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    JSON
                  </span>
                  <span className="text-xs text-gray-400 text-center">
                    Re-importable, round-trips cleanly
                  </span>
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting !== null}
                  className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors disabled:opacity-50"
                >
                  {exporting === 'csv' ? (
                    <Loader size={24} className="animate-spin text-emerald-500" />
                  ) : (
                    <FileSpreadsheet size={24} className="text-emerald-500" />
                  )}
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    CSV
                  </span>
                  <span className="text-xs text-gray-400 text-center">Opens in Excel / Sheets</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {!result && (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload a Goodreads "export library" CSV, or a JSON/CSV file exported from here.
                    Duplicates (matched by ISBN or title &amp; author) are skipped automatically.
                  </p>

                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-8 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
                    <Upload size={24} className="text-gray-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Click to choose a .csv or .json file
                    </span>
                    <input
                      type="file"
                      accept=".csv,.json"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  {parseError && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  {parsed && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300 truncate">
                          {parsed.fileName}
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100 flex-shrink-0 ml-2">
                          {parsed.rows.length} book{parsed.rows.length === 1 ? '' : 's'} ready
                        </span>
                      </div>
                      {parsed.droppedCount > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {parsed.droppedCount} row{parsed.droppedCount === 1 ? '' : 's'} skipped —
                          missing a title or author.
                        </p>
                      )}

                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                        {parsed.rows.slice(0, 8).map((row, i) => (
                          <div key={i} className="px-3 py-2 text-xs">
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {row.title}
                            </span>
                            <span className="text-gray-400"> — {row.author}</span>
                          </div>
                        ))}
                        {parsed.rows.length > 8 && (
                          <div className="px-3 py-2 text-xs text-gray-400">
                            + {parsed.rows.length - 8} more…
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={resetImport}
                          className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        >
                          Choose a different file
                        </button>
                        <button
                          onClick={handleImport}
                          disabled={importing}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-1.5"
                        >
                          {importing ? (
                            <Loader size={16} className="animate-spin" />
                          ) : (
                            `Import ${parsed.rows.length} Book${parsed.rows.length === 1 ? '' : 's'}`
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {result && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4">
                    <CheckCircle2
                      size={22}
                      className="text-emerald-600 dark:text-emerald-400 flex-shrink-0"
                    />
                    <div className="text-sm text-emerald-800 dark:text-emerald-300">
                      <p className="font-semibold">Import finished</p>
                      <p>
                        {result.added} added, {result.skipped} skipped (already in your library)
                        {result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}.
                      </p>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg divide-y divide-red-100 dark:divide-red-900">
                      {result.errors.map((e, i) => (
                        <div key={i} className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
                          {e.row ? `Row ${e.row}` : 'Error'}
                          {e.title ? ` (${e.title})` : ''}: {e.message}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={resetImport}
                    className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    Import another file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExportModal;
