import matplotlib.pyplot as plt

run_id = 1

def plot_core_components(result: dict) -> None:
    """
    Plot the main core power components as a bar chart.
    """
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
    values = [result[k] for k in keys]

    plt.figure()
    plt.bar(labels, values)
    plt.ylabel("Power (W)")
    plt.title("DDR5 Core Power Breakdown by Component")
    plt.xticks(rotation=30)
    plt.tight_layout()
    filename = f"../visualization/plot1_run{run_id}.png"
    plt.savefig(filename)


def plot_vdd_vpp_total(result: dict) -> None:
    """
    Plot VDD core power, VPP core power, and total core power.
    """
    labels = ["VDD core", "VPP core", "Total core"]
    values = [
        result["P_VDD_core"],
        result["P_VPP_core"],
        result["P_total_core"],
    ]

    plt.figure()
    plt.bar(labels, values)
    plt.ylabel("Power (W)")
    plt.title("DDR5 Core Power: VDD vs VPP vs Total")
    plt.tight_layout()
    filename = f"../visualization/plot2_run{run_id}.png"
    plt.savefig(filename)


def plot_core_power_stacked(result: dict) -> None:
    """
    Generate a stacked bar chart for DDR5 core power breakdown.
    Each power component is stacked to show contribution to VDD core total.
    """

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

    values = [result[k] for k in keys]

    # One bar only (the components stack vertically)
    x = ["Core Power"]

    plt.figure(figsize=(6, 5))

    bottom = 0
    for label, value in zip(labels, values):
        plt.bar(x, value, bottom=bottom, label=label)
        bottom += value

    plt.ylabel("Power (W)")
    plt.title("DDR5 Core Power Breakdown (Stacked Bar)")
    plt.legend(loc="upper right", bbox_to_anchor=(1.35, 1.0))
    filename = f"../visualization/plot3_run{run_id}.png"
    plt.savefig(filename)


def plot_power(result: dict):
    plot_core_components(result)
    plot_vdd_vpp_total(result)
    # plot_core_power_stacked(result)