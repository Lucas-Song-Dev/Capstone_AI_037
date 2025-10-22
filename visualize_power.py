import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

plt.style.use('seaborn-v0_8-darkgrid')

def load_data():
    component_data = pd.read_csv('component_summary.csv')
    dram_breakdown = pd.read_csv('dram_breakdown.csv')
    power_metrics = pd.read_csv('power_metrics.csv')
    
    voltage_keys = [col for col in power_metrics.columns if col not in ['Metric', 'Unit']]
    
    return component_data, dram_breakdown, power_metrics, voltage_keys


def plot_component_breakdown(component_data, power_metrics, voltage_keys):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    active_components = component_data[component_data['Total_mW'] > 0].copy()
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
    
    x = np.arange(len(active_components))
    width = 0.6
    
    bottom = np.zeros(len(active_components))
    
    for i, voltage in enumerate(voltage_keys):
        values = active_components[voltage].values
        ax1.bar(x, values, width, label=voltage, bottom=bottom, color=colors[i])
        bottom += values
    
    ax1.set_xlabel('Component', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Power (mW)', fontsize=12, fontweight='bold')
    ax1.set_title('Component Power Breakdown by Voltage Rail', fontsize=14, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(active_components['Component'], fontsize=11)
    ax1.legend(title='Voltage Rail', fontsize=10)
    ax1.grid(axis='y', alpha=0.3)
    
    total_power_w = float(power_metrics[power_metrics['Metric'] == 'Total Power (W)'].iloc[0]['VDD1'])
    total_power_mw = total_power_w * 1000
    
    labels = active_components['Component'].tolist()
    sizes = active_components['Total_mW'].tolist()
    colors_pie = ['#FF6B6B', '#95E1D3', '#FFA07A', '#AA96DA']
    
    def autopct_format(pct):
        return f'{pct:.1f}%\n({pct*total_power_mw/100:.0f} mW)'
    
    wedges, texts, autotexts = ax2.pie(sizes, labels=labels, colors=colors_pie,
                                     autopct=autopct_format, startangle=90)
    
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
        autotext.set_fontsize(9)
    
    ax2.set_title(f'Component Contribution to Total Power\n(Total: {total_power_w:.2f} W)', 
                  fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig('component_power_breakdown.png', dpi=300, bbox_inches='tight')
    print("Created: component_power_breakdown.png")
    
    return fig


def plot_dram_breakdown(dram_breakdown, voltage_keys):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
    
    x = np.arange(len(dram_breakdown))
    width = 0.6
    
    bottom = np.zeros(len(dram_breakdown))
    
    for i, voltage in enumerate(voltage_keys):
        values = dram_breakdown[voltage].values
        ax1.bar(x, values, width, label=voltage, bottom=bottom, color=colors[i])
        bottom += values
    
    ax1.set_xlabel('DRAM Power Type', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Power (mW)', fontsize=12, fontweight='bold')
    ax1.set_title('DRAM Power Breakdown by Type and Voltage Rail', fontsize=14, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(dram_breakdown['Power_Type'].str.replace(' Power', ''), 
                        fontsize=10, rotation=15, ha='right')
    ax1.legend(title='Voltage Rail', fontsize=10)
    ax1.grid(axis='y', alpha=0.3)
    
    x = np.arange(len(dram_breakdown))
    width = 0.2
    
    for i, voltage in enumerate(voltage_keys):
        offset = (i - 1.5) * width
        values = dram_breakdown[voltage].values
        ax2.bar(x + offset, values, width, label=voltage, color=colors[i])
    
    ax2.set_xlabel('DRAM Power Type', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Power (mW)', fontsize=12, fontweight='bold')
    ax2.set_title('DRAM Power by Type (Grouped by Voltage)', fontsize=14, fontweight='bold')
    ax2.set_xticks(x)
    ax2.set_xticklabels(dram_breakdown['Power_Type'].str.replace(' Power', ''), 
                        fontsize=10, rotation=15, ha='right')
    ax2.legend(title='Voltage Rail', fontsize=10)
    ax2.grid(axis='y', alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('dram_power_breakdown.png', dpi=300, bbox_inches='tight')
    print("Created: dram_power_breakdown.png")
    
    return fig


def plot_voltage_breakdown(component_data, dram_breakdown, voltage_keys):
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    
    colors_map = {
        voltage: color for voltage, color in zip(
            voltage_keys, 
            ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
        )
    }
    
    for idx, voltage in enumerate(voltage_keys):
        ax = axes[idx // 2, idx % 2]
        
        categories = []
        values = []
        colors = []
        
        for _, row in dram_breakdown.iterrows():
            if row[voltage] > 0:
                categories.append(row['Power_Type'].replace(' Power', ''))
                values.append(row[voltage])
                colors.append('#FF6B6B')
        
        for _, row in component_data.iterrows():
            if row['Component'] in ['DB', 'PMIC'] and row[voltage] > 0:
                categories.append(row['Component'])
                values.append(row[voltage])
                colors.append('#95E1D3' if row['Component'] == 'DB' else '#FFA07A')
        
        if values:
            y_pos = np.arange(len(categories))
            ax.barh(y_pos, values, color=colors, alpha=0.8)
            ax.set_yticks(y_pos)
            ax.set_yticklabels(categories, fontsize=10)
            ax.set_xlabel('Power (mW)', fontsize=11, fontweight='bold')
            ax.set_title(f'{voltage} Power Distribution\n(Total: {sum(values):.2f} mW)', 
                        fontsize=12, fontweight='bold', color=colors_map[voltage])
            ax.grid(axis='x', alpha=0.3)
            
            for i, v in enumerate(values):
                ax.text(v + max(values)*0.02, i, f'{v:.1f}', 
                       va='center', fontsize=9, fontweight='bold')
        else:
            ax.text(0.5, 0.5, 'No Power on this Rail', 
                   ha='center', va='center', transform=ax.transAxes,
                   fontsize=12, style='italic')
            ax.set_xlim(0, 1)
    
    plt.suptitle('Power Distribution Across Voltage Rails', 
                 fontsize=16, fontweight='bold', y=0.995)
    plt.tight_layout()
    plt.savefig('voltage_rail_breakdown.png', dpi=300, bbox_inches='tight')
    print("Created: voltage_rail_breakdown.png")
    
    return fig


def plot_summary_overview(component_data, dram_breakdown, power_metrics, voltage_keys):
    fig = plt.figure(figsize=(18, 10))
    gs = fig.add_gridspec(3, 3, hspace=0.3, wspace=0.3)
    
    ax_main = fig.add_subplot(gs[0:2, 0:2])
    colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
    
    active_components = component_data[component_data['Total_mW'] > 0].copy()
    x = np.arange(len(active_components))
    width = 0.6
    
    bottom = np.zeros(len(active_components))
    
    for i, voltage in enumerate(voltage_keys):
        values = active_components[voltage].values
        bars = ax_main.bar(x, values, width, label=voltage, bottom=bottom, color=colors[i])
        bottom += values
    
    ax_main.set_xlabel('Component', fontsize=13, fontweight='bold')
    ax_main.set_ylabel('Power (mW)', fontsize=13, fontweight='bold')
    ax_main.set_title('Component Power Distribution by Voltage Rail', 
                      fontsize=15, fontweight='bold')
    ax_main.set_xticks(x)
    ax_main.set_xticklabels(active_components['Component'], fontsize=12)
    ax_main.legend(title='Voltage Rail', fontsize=11, loc='upper left')
    ax_main.grid(axis='y', alpha=0.3)
    
    ax_metrics = fig.add_subplot(gs[0, 2])
    ax_metrics.axis('off')
    
    total_power_w = float(power_metrics[power_metrics['Metric'] == 'Total Power (W)'].iloc[0]['VDD1'])
    
    total_dram = component_data[component_data['Component'] == 'DRAM']['Total_mW'].values[0]
    total_pmic = component_data[component_data['Component'] == 'PMIC']['Total_mW'].values[0]
    total_db = component_data[component_data['Component'] == 'DB']['Total_mW'].values[0]
    total_rcd = component_data[component_data['Component'] == 'RCD']['Total_mW'].values[0]
    
    metrics_text = f"""
    KEY METRICS
    ═══════════════
    Total Power: {total_power_w:.2f} W
    
    DRAM Power: {total_dram:.1f} mW
      ({total_dram/total_power_w/10:.1f}%)
    
    PMIC Power: {total_pmic:.1f} mW
      ({total_pmic/total_power_w/10:.1f}%)
    
    DB Power: {total_db:.1f} mW
      ({total_db/total_power_w/10:.1f}%)
    
    RCD Power: {total_rcd:.1f} mW
      ({total_rcd/total_power_w/10:.1f}%)
    """
    
    ax_metrics.text(0.1, 0.95, metrics_text, transform=ax_metrics.transAxes,
                    fontsize=11, verticalalignment='top', family='monospace',
                    bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3))
    
    ax_dram_pie = fig.add_subplot(gs[1:, 2])
    
    dram_totals = dram_breakdown['Total_mW'].values
    dram_labels = dram_breakdown['Power_Type'].str.replace(' Power', '').tolist()
    colors_pie = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#95E1D3', '#AA96DA']
    
    wedges, texts, autotexts = ax_dram_pie.pie(dram_totals, labels=dram_labels, 
                                              colors=colors_pie, autopct='%1.1f%%',
                                              startangle=90, textprops={'fontsize': 9},
                                              radius=0.8)
    
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
    
    ax_dram_pie.set_title('DRAM Power Distribution', fontsize=12, fontweight='bold', pad=20)
    
    ax_voltage = fig.add_subplot(gs[2, 0:2])
    
    voltage_totals = []
    for voltage in voltage_keys:
        total = component_data[voltage].sum()
        voltage_totals.append(total)
    
    bars = ax_voltage.bar(voltage_keys, voltage_totals, color=colors, alpha=0.8, width=0.6)
    ax_voltage.set_ylabel('Total Power (mW)', fontsize=12, fontweight='bold')
    ax_voltage.set_xlabel('Voltage Rail', fontsize=12, fontweight='bold')
    ax_voltage.set_title('Total Power per Voltage Rail', fontsize=13, fontweight='bold')
    ax_voltage.grid(axis='y', alpha=0.3)
    
    for bar, value in zip(bars, voltage_totals):
        height = bar.get_height()
        ax_voltage.text(bar.get_x() + bar.get_width()/2., height,
                       f'{value:.1f} mW\n({value/total_power_w/10:.1f}%)',
                       ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    plt.suptitle('DRAM Power Analysis Dashboard', fontsize=18, fontweight='bold', y=0.998)
    plt.savefig('power_summary_dashboard.png', dpi=300, bbox_inches='tight')
    print("Created: power_summary_dashboard.png")
    
    return fig


def main():
    print("Loading data from CSV files...")
    component_data, dram_breakdown, power_metrics, voltage_keys = load_data()
    
    print("\nGenerating visualizations...")
    print("-" * 50)
    
    plot_component_breakdown(component_data, power_metrics, voltage_keys)
    plot_dram_breakdown(dram_breakdown, voltage_keys)
    plot_voltage_breakdown(component_data, dram_breakdown, voltage_keys)
    plot_summary_overview(component_data, dram_breakdown, power_metrics, voltage_keys)
    
    print("-" * 50)
    print("\nVisualization complete!")
    print("\nGenerated plots:")
    print("  1. component_power_breakdown.png - Component contributions")
    print("  2. dram_power_breakdown.png - DRAM internal breakdown")
    print("  3. voltage_rail_breakdown.png - Voltage rail distributions")
    print("  4. power_summary_dashboard.png - Comprehensive overview")
    print("\nAll plots have been saved in the current directory.")
    
    plt.show()


if __name__ == '__main__':
    main()