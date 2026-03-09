import matplotlib.pyplot as plt
from typing import Dict, Optional

run_id = 1


def _detect_memory_type(result: Dict[str, float]) -> str:
    """
    Detect memory type based on power dictionary keys.
    Returns 'DDR5' or 'LPDDR5'.
    """
    # Check both prefixed (DIMM results) and unprefixed (device results)
    if "P_VPP_core" in result or "core.P_VPP_core" in result:
        return "DDR5"
    elif "P_VDD1" in result or "core.P_VDD1" in result or "P_VDD2H" in result or "core.P_VDD2H" in result:
        return "LPDDR5"
    else:
        # Default fallback
        return "DDR5"


def _get_value(result: Dict[str, float], key: str, prefix: str = "core") -> float:
    """
    Get value from result dictionary, handling both prefixed and unprefixed keys.
    Tries key with prefix first, then without prefix.
    
    Args:
        result: Power results dictionary
        key: Base key name (e.g., "P_PRE_STBY_core")
        prefix: Prefix to try first (default: "core")
    
    Returns:
        Value from dictionary or 0.0 if not found
    """
    # Try prefixed key first (DIMM results format)
    prefixed_key = f"{prefix}.{key}"
    if prefixed_key in result:
        return result[prefixed_key]
    # Fall back to unprefixed key (device results format)
    return result.get(key, 0.0)


def plot_core_components(result: Dict[str, float], memory_type: Optional[str] = None) -> None:
    """
    Plot the main core power components as a bar chart.
    Supports both DDR5 and LPDDR5.
    """
    if memory_type is None:
        memory_type = _detect_memory_type(result)
    
    labels = [
        "PRE_STBY",
        "ACT_STBY",
        "ACT/PRE",
        "READ",
        "WRITE",
        "REFRESH",
    ]
    keys = [
        "P_PRE_STBY_core",
        "P_ACT_STBY_core",
        "P_ACT_PRE_core",
        "P_RD_core",
        "P_WR_core",
        "P_REF_core",
    ]
    values = [_get_value(result, k) for k in keys]

    plt.figure()
    plt.bar(labels, values, color='steelblue')
    plt.ylabel("Power (W)")
    plt.title(f"{memory_type} Core Power Breakdown by Component")
    plt.xticks(rotation=30)
    plt.tight_layout()
    filename = f"../visualization/plot1_core_components_run{run_id}.png"
    plt.savefig(filename)
    print(f"Saved: {filename}")


def plot_rail_breakdown(result: Dict[str, float], memory_type: Optional[str] = None) -> None:
    """
    Plot power rails breakdown.
    DDR5: VDD, VPP, Total
    LPDDR5: VDD1, VDD2H, VDD2L, VDDQ, Total
    """
    if memory_type is None:
        memory_type = _detect_memory_type(result)
    
    plt.figure()
    
    if memory_type == "DDR5":
        labels = ["VDD core", "VPP core", "Total core"]
        keys = ["P_VDD_core", "P_VPP_core", "P_total_core"]
        # P_total_core is not prefixed in DIMM results
        values = [
            _get_value(result, "P_VDD_core"),
            _get_value(result, "P_VPP_core"),
            result.get("P_total_core", 0.0)  # Always unprefixed
        ]
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c']
        
        plt.bar(labels, values, color=colors)
        plt.ylabel("Power (W)")
        plt.title("DDR5 Core Power: VDD vs VPP vs Total")
    else:  # LPDDR5
        labels = ["VDD1", "VDD2H", "VDD2L", "VDDQ", "Total"]
        keys = ["P_VDD1", "P_VDD2H", "P_VDD2L", "P_VDDQ", "P_total_core"]
        # All rails are prefixed, but P_total_core is not
        values = [
            _get_value(result, "P_VDD1"),
            _get_value(result, "P_VDD2H"),
            _get_value(result, "P_VDD2L"),
            _get_value(result, "P_VDDQ"),
            result.get("P_total_core", 0.0)  # Always unprefixed
        ]
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']
        
        plt.bar(labels, values, color=colors)
        plt.ylabel("Power (W)")
        plt.title("LPDDR5 Core Power by Rail")
    
    plt.tight_layout()
    filename = f"../visualization/plot2_rail_breakdown_run{run_id}.png"
    plt.savefig(filename)
    print(f"Saved: {filename}")


def plot_core_power_stacked(result: Dict[str, float], memory_type: Optional[str] = None) -> None:
    """
    Generate a stacked bar chart for core power breakdown.
    Each power component is stacked to show contribution to total.
    """
    if memory_type is None:
        memory_type = _detect_memory_type(result)

    # Component order for stacking
    labels = [
        "PRE_STBY",
        "ACT_STBY",
        "ACT/PRE",
        "READ",
        "WRITE",
        "REFRESH",
    ]

    keys = [
        "P_PRE_STBY_core",
        "P_ACT_STBY_core",
        "P_ACT_PRE_core",
        "P_RD_core",
        "P_WR_core",
        "P_REF_core",
    ]

    values = [_get_value(result, k) for k in keys]

    # One bar only (the components stack vertically)
    x = ["Core Power"]

    plt.figure(figsize=(6, 5))

    bottom = 0
    colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b']
    for label, value, color in zip(labels, values, colors):
        plt.bar(x, value, bottom=bottom, label=label, color=color)
        bottom += value

    plt.ylabel("Power (W)")
    plt.title(f"{memory_type} Core Power Breakdown (Stacked)")
    plt.legend(loc="upper left", bbox_to_anchor=(1.02, 1.0))
    plt.tight_layout()
    filename = f"../visualization/plot3_stacked_run{run_id}.png"
    plt.savefig(filename)
    print(f"Saved: {filename}")


def plot_dimm_total_breakdown(result: Dict[str, float], memory_type: Optional[str] = None) -> None:
    """
    Plot DIMM-level total power breakdown (core vs interface).
    """
    if memory_type is None:
        memory_type = _detect_memory_type(result)
    
    # Handle both direct dict and nested dict (from DIMM.compute_all)
    core_total = result.get("P_total_core", 0.0)
    interface_total = result.get("P_total_interface", 0.0)
    
    if core_total == 0.0 and "core.P_total_core" in result:
        core_total = result["core.P_total_core"]
    if interface_total == 0.0 and "if.P_total_interface" in result:
        interface_total = result["if.P_total_interface"]
    
    labels = ["Core", "Interface", "Total"]
    values = [core_total, interface_total, core_total + interface_total]
    colors = ['#2ca02c', '#ff7f0e', '#1f77b4']
    
    plt.figure()
    plt.bar(labels, values, color=colors)
    plt.ylabel("Power (W)")
    plt.title(f"{memory_type} DIMM Total Power Breakdown")
    plt.tight_layout()
    filename = f"../visualization/plot4_dimm_total_run{run_id}.png"
    plt.savefig(filename)
    print(f"Saved: {filename}")


def plot_power(result: Dict[str, float], memory_type: Optional[str] = None) -> None:
    """
    Generate all power visualization plots.
    Automatically detects memory type if not provided.
    
    Args:
        result: Power calculation results dictionary
        memory_type: 'DDR5' or 'LPDDR5' (auto-detected if None)
    """
    if memory_type is None:
        memory_type = _detect_memory_type(result)
    
    print(f"\nGenerating {memory_type} power visualizations...")
    
    plot_core_components(result, memory_type)
    plot_rail_breakdown(result, memory_type)
    plot_core_power_stacked(result, memory_type)
    
    # Only plot DIMM breakdown if interface data is present
    if "P_total_interface" in result or "if.P_total_interface" in result:
        plot_dimm_total_breakdown(result, memory_type)
    
    print(f"All visualizations complete for {memory_type}!\n")