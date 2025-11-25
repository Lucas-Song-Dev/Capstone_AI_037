from parser import parse_memspec_json

def main() -> None:
    import sys
    path = '../workloads/micron_16gb_ddr5_6400_x8_spec.json'
    with open(path, "r", encoding="utf-8") as f:
        json_str = f.read()

    memspec = parse_memspec_json(json_str)

    # Example: print some parsed fields
    print("Memory ID:", memspec.memoryId)
    print("Type:", memspec.memoryType)
    print("Width (bits):", memspec.memarchitecturespec.width)
    print("Banks:", memspec.memarchitecturespec.nbrOfBanks)
    print("IDD4R (A):", memspec.mempowerspec.idd4r)
    print("tCK (s):", memspec.memtimingspec.tCK)


if __name__ == "__main__":
    main()
