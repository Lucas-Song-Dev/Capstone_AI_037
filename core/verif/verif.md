# Verification Files

### `run_mlc_and_log.py`
- Starts the Intel MLC benchmark and prompts user to start HWiNFO logging (or automatically starts/stops logging using Ctrl+Shift+L if not on WSL).
- Requires a path to the MLC binary with commandline argument `--mlc-path`, relative to the current directory.
- HWiNFO will generate a `.csv` containing the realtime power information, but this needs to be trimmed of superfluous columns (use `trim_hwinfo_log.py`).

### `trim_hwinfo_log.py`
- Once `run_mlc_and_log.py` has completed, HWiNFO log will be stored in the main HWiNFO directory (at least on Windows; e.g. at `D:\Program Files (x86)\HWiNFO64\HWiNFO_LOG_169916265.CSV`).
- Supply commandline argument `--input-path` pointing to the generated HWiNFO log file like above.
- Supply commandline argument `--output-path` pointing to where in the repo directory you want the trimmed file to be saved at.
- Supply commandline argument `--keep-cols` which takes a space-separated list of (pairs of column indices separated by hyphen) to represent which columns in the `--input-path` file to keep. For example, `--keep-cols C-H J-Z` will delete all columns from the `.csv` file except for columns C to H (inclusive), and J to Z (inclusive).

### `verif.py`:
- Main file containing testcases. Run with `python verif.py` while in `core/verif` directory.
- Run with commandline argument `--empirical-data` pointing to the relative path to the `.csv` file containing the measured total power figures from HWiNFO, trimmed as per `trim_hwinfo_log.py`. This will compare the model outputs to the reported measurements. Otherwise, simply compares to the stored baseline.
