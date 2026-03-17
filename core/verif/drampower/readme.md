**Verification planning:**


**Verification goals:** Prove our model’s reported average power match the reference simulator(Drampower) for the same DRAM config and same command/timing behaviour.

**Define Drampower reference:** create alignment so both sides uses identical:
* DRAM type (DDR5/LPDDR), density, ranks, banks/bank-groups
* Frequency (tCK) and key timings (tRCD, tRAS, tRP, tRFC, tREFI)
* Voltages and IDD current table

**Drampower Usage:**
* build according to https://github.com/tukl-msd/DRAMPower
* use the cli tool in root: ./build/bin/cli -c build/bin/config.json -m tests/tests_drampower/resources/ddr5.json -t trace_1.csv -j out/output_trace_1_base.json
    * this command takes 
    * —c: a simulation config, for data toggling, unmodified. 
    * —m: a ddr spec. in order to align with our tool, we need to adjust accordingly such as idd numbers and timing parameters. 
    * —t: an input trace: I generated with ramulator. It should represent 1/7 of total host instructions are memory read instruction.
    * —j: output file: energy report for separate banks
* post process and report power: python3 calculate_power.py --json out/output_trace_1_base_6400.json --cycles 2919445 --tck 0.312e-9 --memspec_json tests/tests_drampower/resources/ddr5.json
    * I created this script for comparison
    * —json: the output from previous command
    * —cycles: total simulated cycles in trace_1.csv
    * —tsk: desired clock time
    * —memspec_json: the ddr spec sheet

**My findings:** I think the ddr specification in our project is not aligned in scope. Specifically micron_16gb_ddr5_4800_x8_spec.json looks like module/dimm level spec rather than ddr5 device. Our model assumes per device current is provided in the idd table. 

Using the spec provided by drampower for our tool, the power reports is ~40% less. Maybe this help with the overestimating Kenn discovered. 