#!/usr/bin/env python3
"""
Create folder structure for regulatory dossier sections
"""
import os
import json
from datetime import datetime

# Create the scripts directory first
os.makedirs(os.path.dirname("/Users/rsjaya/Downloads/DossierFlow AI Wireframe Blueprint/scripts/create_sections.py"), exist_ok=True)

sections = [
    {"title": "Protocol Summary", "summary": "Overview of the clinical protocol including synopsis, schema, and schedule of activities.", "originalHeading": "### 1. **Protocol Summary**"},
    {"title": "Synopsis", "summary": "Concise summary of the study design, objectives, and key parameters.", "originalHeading": "#### 1.1. Synopsis"},
    {"title": "Schema", "summary": "Visual/structural representation of the study design and flow.", "originalHeading": "#### 1.2. Schema"},
    {"title": "Schedule of Activities (SoA)", "summary": "Timeline and schedule for all study procedures and assessments.", "originalHeading": "#### 1.3. Schedule of Activities (SoA)"},
    {"title": "Introduction", "summary": "Background information and rationale for conducting the clinical study.", "originalHeading": "### 2. **Introduction**"},
    {"title": "Study Rationale", "summary": "Scientific and medical justification for the study.", "originalHeading": "#### 2.1. Study Rationale"},
    {"title": "Background", "summary": "Context and existing knowledge about the disease/treatment area.", "originalHeading": "#### 2.2. Background"},
    {"title": "Benefit/Risk Assessment", "summary": "Evaluation of potential benefits versus risks for study participants.", "originalHeading": "#### 2.3. Benefit/Risk Assessment"},
    {"title": "Risk Assessment", "summary": "Detailed evaluation of potential risks and mitigation strategies.", "originalHeading": "##### 2.3.1. Risk Assessment"},
    {"title": "Benefit Assessment", "summary": "Evaluation of anticipated benefits to participants and medical community.", "originalHeading": "##### 2.3.2. Benefit Assessment"},
    {"title": "Overall Benefit Risk Conclusion", "summary": "Summary conclusion on benefit-risk balance for the protocol.", "originalHeading": "##### 2.3.3. Overall Benefit Risk Conclusion"},
    {"title": "Objectives, Endpoints, and Estimands", "summary": "Primary and secondary objectives with associated endpoints and estimands framework.", "originalHeading": "### 3. **Objectives, Endpoints, and Estimands**"},
    {"title": "Study Design", "summary": "Comprehensive description of the clinical study design including scientific rationale.", "originalHeading": "### 4. **Study Design**"},
    {"title": "Overall Design", "summary": "High-level study design architecture and methodology.", "originalHeading": "#### 4.1. Overall Design"},
    {"title": "Scientific Rationale for Study Design", "summary": "Justification for the chosen study design approach.", "originalHeading": "#### 4.2. Scientific Rationale for Study Design"},
    {"title": "Patient Input into Design", "summary": "Incorporation of patient perspectives in study design.", "originalHeading": "##### 4.2.1. Patient Input into Design"},
    {"title": "Justification for Dose", "summary": "Rationale for selected dose levels and regimens.", "originalHeading": "#### 4.3. Justification for Dose"},
    {"title": "End-of-Study Definition", "summary": "Criteria and procedures for study completion.", "originalHeading": "#### 4.4. End‑of‑Study Definition"},
    {"title": "Study Population", "summary": "Definition of target patient population and selection criteria.", "originalHeading": "### 5. **Study Population**"},
    {"title": "Inclusion Criteria", "summary": "Specific criteria that participants must meet to be eligible for enrollment.", "originalHeading": "#### 5.1. Inclusion Criteria"},
    {"title": "Exclusion Criteria", "summary": "Specific criteria that would exclude potential participants from enrollment.", "originalHeading": "#### 5.2. Exclusion Criteria"},
    {"title": "Lifestyle Considerations", "summary": "Restrictions and considerations related to participant lifestyle during the study.", "originalHeading": "#### 5.3. Lifestyle Considerations"},
    {"title": "Meals and Dietary Restrictions", "summary": "Dietary requirements and restrictions for participants.", "originalHeading": "##### 5.3.1. Meals and Dietary Restrictions"},
    {"title": "Caffeine, Alcohol, and Tobacco", "summary": "Restrictions on caffeine, alcohol, and tobacco use during the study.", "originalHeading": "##### 5.3.2. Caffeine, Alcohol, and Tobacco"},
    {"title": "Activity", "summary": "Physical activity restrictions and requirements.", "originalHeading": "##### 5.3.3. Activity"},
    {"title": "Other Restrictions", "summary": "Additional lifestyle restrictions not covered elsewhere.", "originalHeading": "##### 5.3.4. Other Restrictions"},
    {"title": "Screen Failures", "summary": "Procedures for handling participants who fail screening.", "originalHeading": "#### 5.4. Screen Failures"},
    {"title": "Criteria for Temporarily Delaying Enrollment", "summary": "Conditions under which enrollment may be temporarily paused.", "originalHeading": "#### 5.5. Criteria for Temporarily Delaying"},
    {"title": "Study Intervention(s) and Concomitant Therapy", "summary": "Details on study interventions and allowed concomitant medications.", "originalHeading": "### 6. **Study Intervention(s) and Concomitant Therapy**"},
    {"title": "Study Intervention(s) Administered", "summary": "Complete description of investigational and control interventions.", "originalHeading": "#### 6.1. Study Intervention(s) Administered"},
    {"title": "Rescue Medicine", "summary": "Provisions for rescue medication during the study.", "originalHeading": "##### 6.1.1. Rescue Medicine"},
    {"title": "Medical Devices", "summary": "Medical device components of the study intervention.", "originalHeading": "##### 6.1.2. Medical Devices"},
    {"title": "Preparation, Handling, Storage, and Accountability", "summary": "Procedures for drug product management and accountability.", "originalHeading": "#### 6.2. Preparation, Handling, Storage, and Accountability"},
    {"title": "Assignment to Study Intervention", "summary": "Randomization and treatment allocation procedures.", "originalHeading": "#### 6.3. Assignment to Study Intervention"},
    {"title": "Blinding/Masking", "summary": "Blinding methodology and procedures.", "originalHeading": "#### 6.4. [Blinding, Masking]"},
    {"title": "Study Intervention Compliance", "summary": "Methods for ensuring and documenting treatment compliance.", "originalHeading": "#### 6.5. Study Intervention Compliance"},
    {"title": "Dose Modification", "summary": "Criteria and procedures for dose adjustments.", "originalHeading": "#### 6.6. Dose Modification"},
    {"title": "Retreatment Criteria", "summary": "Criteria for allowing retreatment after discontinuation.", "originalHeading": "##### 6.6.1. Retreatment Criteria"},
    {"title": "Continued Access to Study Intervention", "summary": "Provisions for continued access after study completion.", "originalHeading": "#### 6.7. Continued Access to Study Intervention after the End of the Study"},
    {"title": "Treatment of Overdose", "summary": "Procedures for managing overdose situations.", "originalHeading": "#### 6.8. Treatment of Overdose"},
    {"title": "Prior and Concomitant Therapy", "summary": "Restrictions on prior and concomitant medications.", "originalHeading": "# 6.9. Prior and Concomitant Therapy"},
    {"title": "Discontinuation of Study Intervention and Participant Discontinuation/Withdrawal", "summary": "Criteria and procedures for study discontinuation and participant withdrawal.", "originalHeading": "### 7. **Discontinuation of Study Intervention and Participant Discontinuation/Withdrawal**"},
    {"title": "Discontinuation of Study Intervention", "summary": "Criteria for discontinuing study intervention.", "originalHeading": "#### 7.1. Discontinuation of Study Intervention"},
    {"title": "Liver Event Stopping Criteria", "summary": "Specific criteria for discontinuation due to liver events.", "originalHeading": "##### 7.1.1. Liver Event Stopping Criteria"},
    {"title": "QTc Stopping Criteria", "summary": "Specific criteria for discontinuation due to QT interval changes.", "originalHeading": "##### 7.1.2. QTc Stopping Criteria"},
    {"title": "Temporary Discontinuation", "summary": "Procedures for temporary study intervention discontinuation.", "originalHeading": "##### 7.1.3. Temporary Discontinuation"},
    {"title": "Rechallenge", "summary": "Procedures for re-exposure after discontinuation.", "originalHeading": "##### 7.1.4. Rechallenge"},
    {"title": "Participant Discontinuation/Withdrawal", "summary": "Participant-initiated discontinuation procedures.", "originalHeading": "#### 7.2. Participant Discontinuation/Withdrawal from the Study"},
    {"title": "Lost to Follow-up", "summary": "Procedures for participants lost to follow-up.", "originalHeading": "#### 7.3. Lost to Follow up"},
    {"title": "Study Assessments and Procedures", "summary": "All clinical assessments, procedures, and evaluations conducted during the study.", "originalHeading": "### 8. **Study Assessments and Procedures**"},
    {"title": "Administrative and General Procedures", "summary": "Administrative procedures including informed consent and baseline assessments.", "originalHeading": "#### 8.1. Administrative [and General/Baseline] Procedures"},
    {"title": "Efficacy and/or Immunogenicity Assessments", "summary": "Clinical efficacy and immunogenicity measurements and evaluations.", "originalHeading": "#### 8.2. [Efficacy and/or Immunogenicity] Assessments"},
    {"title": "Safety Assessments", "summary": "Comprehensive safety monitoring and assessment procedures.", "originalHeading": "#### 8.3. Safety Assessments"},
    {"title": "Physical Examinations", "summary": "Physical examination procedures and timing.", "originalHeading": "##### 8.3.1. Physical Examinations"},
    {"title": "Vital Signs", "summary": "Vital signs monitoring procedures.", "originalHeading": "##### 8.3.2. Vital Signs"},
    {"title": "Electrocardiograms", "summary": "ECG monitoring and evaluation procedures.", "originalHeading": "##### 8.3.3. Electrocardiograms"},
    {"title": "Clinical Safety Laboratory Tests", "summary": "Safety laboratory testing requirements and procedures.", "originalHeading": "##### 8.3.4. Clinical Safety Laboratory Tests"},
    {"title": "Pregnancy Testing", "summary": "Pregnancy testing requirements and procedures.", "originalHeading": "##### 8.3.5. Pregnancy Testing"},
    {"title": "Suicidal Ideation and Behavior Risk Monitoring", "summary": "Monitoring for suicidal ideation and behavior.", "originalHeading": "##### 8.3.6. Suicidal Ideation and Behavior Risk Monitoring"},
    {"title": "Adverse Events and Safety Reporting", "summary": "Comprehensive adverse event collection and reporting procedures.", "originalHeading": "#### 8.4. Adverse Events (AEs) Serious Adverse Events (SAEs), and Other Safety Reporting"},
    {"title": "AE and SAE Collection Time Period", "summary": "Timeframes for collecting adverse event information.", "originalHeading": "##### 8.4.1. Time Period and Frequency for Collecting AE and SAE Information"},
    {"title": "AE and SAE Detection Methods", "summary": "Methods for detecting and capturing adverse events.", "originalHeading": "##### 8.4.2. Method of Detecting AEs and SAEs"},
    {"title": "AE and SAE Follow-up", "summary": "Procedures for following up on adverse events.", "originalHeading": "##### 8.4.3. Follow‑up of AEs and SAEs"},
    {"title": "Regulatory Reporting Requirements", "summary": "Regulatory reporting obligations for serious adverse events.", "originalHeading": "##### 8.4.4. Regulatory Reporting Requirements for SAEs"},
    {"title": "Pregnancy Reporting", "summary": "Pregnancy reporting requirements and procedures.", "originalHeading": "##### 8.4.5. Pregnancy"},
    {"title": "Cardiovascular and Death Events", "summary": "Special reporting requirements for cardiovascular events and deaths.", "originalHeading": "##### 8.4.6. Cardiovascular and Death Events"},
    {"title": "Disease-related Events", "summary": "Handling of disease-related events not qualifying as AEs or SAEs.", "originalHeading": "##### 8.4.7. Disease‑related Events and/or Disease‑related Outcomes Not Qualifying as AEs or SAEs"},
    {"title": "Adverse Events of Special Interest", "summary": "Monitoring and reporting for adverse events of special interest.", "originalHeading": "##### 8.4.8. Adverse Events of Special Interest"},
    {"title": "Medical Device Deficiencies", "summary": "Handling of medical device deficiencies in device studies.", "originalHeading": "##### 8.4.9. Medical Device Deficiencies"},
    {"title": "Pharmacokinetics", "summary": "Pharmacokinetic sampling and analysis procedures.", "originalHeading": "#### 8.5. Pharmacokinetics"},
    {"title": "Pharmacodynamics", "summary": "Pharmacodynamic assessments and evaluations.", "originalHeading": "#### 8.6. Pharmacodynamics"},
    {"title": "Genetics", "summary": "Genetic testing and sample collection procedures.", "originalHeading": "#### 8.7. Genetics"},
    {"title": "Biomarkers", "summary": "Biomarker sampling, analysis, and data collection.", "originalHeading": "#### 8.8. Biomarkers"},
    {"title": "Immunogenicity Assessments", "summary": "Immunogenicity testing and evaluation procedures.", "originalHeading": "#### 8.9. Immunogenicity Assessments"},
    {"title": "Health Economics", "summary": "Health economics and medical resource utilization assessments.", "originalHeading": "#### 8.10. [Health Economics OR Medical Resource Utilization and Health Economics]"},
    {"title": "Statistical Considerations", "summary": "Statistical analysis methodology and considerations.", "originalHeading": "### 9. **Statistical Considerations**"},
    {"title": "General Statistical Considerations", "summary": "Overview of statistical approaches and methodologies.", "originalHeading": "#### 9.1. General Considerations"},
    {"title": "Decision Criteria and Statistical Hypotheses", "summary": "Statistical hypotheses and decision criteria for analyses.", "originalHeading": "##### 9.1.1. [Decision Criteria/Statistical Hypotheses]"},
    {"title": "Multiplicity Adjustment", "summary": "Methods for adjusting multiple comparisons.", "originalHeading": "##### 9.1.2. Multiplicity Adjustment"},
    {"title": "Intercurrent Events Strategies", "summary": "Strategies for handling intercurrent events in analyses.", "originalHeading": "##### 9.1.3. Impact of Intercurrent Events Strategies"},
    {"title": "Handling of Missing Data", "summary": "Methods for handling missing data in statistical analyses.", "originalHeading": "# 9.1.4. Handling of Missing Data"},
    {"title": "Analysis Sets", "summary": "Definition of analysis populations and datasets.", "originalHeading": "# 9.2. Analysis Sets"},
    {"title": "Analyses Supporting Primary Objectives", "summary": "Statistical analyses to support primary study objectives.", "originalHeading": "# 9.3. Analyses Supporting Primary Objective(s)"},
    {"title": "Primary Endpoint Analyses", "summary": "Detailed analysis of primary endpoints and estimands.", "originalHeading": "## 9.3.1. Primary [Endpoint(s)/Estimand(s)]"},
    {"title": "Analyses Supporting Secondary Objectives", "summary": "Statistical analyses to support secondary objectives.", "originalHeading": "# 9.4. Analyses Supporting Secondary Objective(s)"},
    {"title": "Secondary Objective Analyses", "summary": "Detailed analysis for specific secondary objectives.", "originalHeading": "## 9.4.1. Analyses Supporting Secondary Objective [label]"},
    {"title": "Tertiary/Exploratory Objective Analyses", "summary": "Analyses for tertiary and exploratory objectives.", "originalHeading": "# 9.5. Analyses Supporting [Tertiary/Exploratory/Other] Objective(s)"},
    {"title": "Other Safety Analyses", "summary": "Additional safety analyses beyond primary safety endpoints.", "originalHeading": "# 9.6. [Other] Safety Analyses"},
    {"title": "Other Analyses", "summary": "Miscellaneous additional analyses not covered elsewhere.", "originalHeading": "# 9.7. Other Analyses"},
    {"title": "Other Variables and Parameters", "summary": "Analysis of additional variables and parameters.", "originalHeading": "## 9.7.1. Other variables and/or parameters"},
    {"title": "Subgroup Analyses", "summary": "Predefined and exploratory subgroup analyses.", "originalHeading": "## 9.7.2. Subgroup analyses"},
    {"title": "Interim Analysis", "summary": "Planned interim analysis procedures and stopping rules.", "originalHeading": "# 9.8. Interim [Analysis/Analyses]"},
    {"title": "Sample Size Determination", "summary": "Sample size calculation methodology and assumptions.", "originalHeading": "# 9.9. Sample Size Determination"},
    {"title": "Supporting Documentation and Operational Considerations", "summary": "Regulatory, logistical, and operational study information.", "originalHeading": "### 10. **Supporting Documentation and Operational Considerations**"},
    {"title": "Regulatory, Ethical, and Study Oversight", "summary": "Regulatory compliance and ethical oversight considerations.", "originalHeading": "## 10.1. Appendix 1: Regulatory, Ethical, and Study Oversight Considerations"},
    {"title": "Regulatory and Ethical Considerations", "summary": "Detailed regulatory and ethical compliance requirements.", "originalHeading": "### 10.1.1. Regulatory and Ethical Considerations"},
    {"title": "Financial Disclosure", "summary": "Financial disclosure requirements for investigators and sponsors.", "originalHeading": "### 10.1.2. Financial Disclosure"},
    {"title": "Informed Consent Process", "summary": "Procedures for obtaining informed consent from participants.", "originalHeading": "### 10.1.3. Informed Consent Process"},
    {"title": "Recruitment Strategy", "summary": "Participant recruitment approaches and strategies.", "originalHeading": "### 10.1.4. Recruitment strategy"},
    {"title": "Data Protection", "summary": "Data protection and privacy safeguards.", "originalHeading": "### 10.1.5. Data Protection"},
    {"title": "Committees Structure", "summary": "Independent committees (DSMB, Safety, etc.) structure and responsibilities.", "originalHeading": "### 10.1.6. Committees Structure"},
    {"title": "Dissemination of Clinical Study Data", "summary": "Plans for sharing study results and data.", "originalHeading": "### 10.1.7. Dissemination of Clinical Study Data"},
    {"title": "Data Quality Assurance", "summary": "Quality assurance measures for study data integrity.", "originalHeading": "### 10.1.8. Data Quality Assurance"},
    {"title": "Source Documents", "summary": "Documentation requirements for source data verification.", "originalHeading": "### 10.1.9. Source Documents"},
    {"title": "Study and Site Start and Closure", "summary": "Procedures for study and site initiation and closure.", "originalHeading": "### 10.1.10. Study and Site Start and Closure"},
    {"title": "Publication Policy", "summary": "Guidelines for publishing and presenting study results.", "originalHeading": "### 10.1.11. Publication Policy"},
    {"title": "Clinical Laboratory Tests", "summary": "Reference ranges and requirements for clinical laboratory tests.", "originalHeading": "## 10.2. Appendix 2: Clinical Laboratory Tests"},
    {"title": "AEs and SAEs: Definitions and Procedures", "summary": "Comprehensive guidance on AE/SAE definitions and reporting.", "originalHeading": "## 10.3. Appendix 3: AEs and SAEs: Definitions and Procedures for Recording, Evaluating, Follow‑up, and Reporting"},
    {"title": "Definition of AE", "summary": "Detailed definition of adverse events.", "originalHeading": "### 10.3.1. Definition of AE"},
    {"title": "Definition of SAE", "summary": "Detailed definition of serious adverse events.", "originalHeading": "### 10.3.2. Definition of SAE"},
    {"title": "Recording and Follow-up of AE and SAE", "summary": "Procedures for documenting and following up adverse events.", "originalHeading": "### 10.3.3. Recording and Follow‑Up of AE and SAE"},
    {"title": "Reporting of SAEs", "summary": "Regulatory reporting requirements for serious adverse events.", "originalHeading": "### 10.3.4. Reporting of SAEs"},
    {"title": "Contraceptive and Barrier Guidance", "summary": "Guidance on contraceptive requirements for study participants.", "originalHeading": "## 10.4. Appendix 4: Contraceptive and Barrier Guidance"},
    {"title": "Contraception Definitions", "summary": "Definitions related to contraception requirements.", "originalHeading": "### 10.4.1. Definitions"},
    {"title": "Contraception Guidance", "summary": "Specific contraceptive requirements and acceptable methods.", "originalHeading": "### 10.4.2. Contraception Guidance"},
    {"title": "Genetics Appendix", "summary": "Genetics-related procedures and sample handling.", "originalHeading": "## 10.5. Appendix 5: Genetics"},
    {"title": "Liver Safety Guidelines", "summary": "Specific guidelines for monitoring and managing liver safety.", "originalHeading": "## 10.6. Appendix 6: Liver Safety: Suggestions and Guidelines for Liver Events"},
    {"title": "Medical Device Safety Events", "summary": "Definitions and procedures for medical device adverse events and deficiencies.", "originalHeading": "## 10.7. Appendix 7: Medical Device AEs, ADEs, SAEs, SADEs, USADEs and Device Deficiencies"},
    {"title": "Medical Device AE and ADE Definition", "summary": "Definitions for medical device adverse events and adverse device effects.", "originalHeading": "### 10.7.1. Definition of Medical Device AE and ADE"},
    {"title": "Medical Device SAE Definition", "summary": "Definitions for serious adverse events related to medical devices.", "originalHeading": "### 10.7.2. Definition of Medical Device SAE, SADE and USADE"},
    {"title": "Device Deficiency Definition", "summary": "Definition of medical device deficiencies.", "originalHeading": "# 10.7.3. Definition of Device Deficiency"},
    {"title": "Recording and Follow-Up for Medical Device Events", "summary": "Procedures for documenting and following up device-related events.", "originalHeading": "# 10.7.4. Recording and Follow-Up of Medical Device AE and/or SAE and Device Deficiencies"},
    {"title": "Medical Device SAE Reporting", "summary": "Reporting requirements for medical device serious adverse events.", "originalHeading": "# 10.7.5. Reporting of Medical Device SAEs"},
    {"title": "SADE Reporting", "summary": "Reporting requirements for serious adverse device effects.", "originalHeading": "# 10.7.6. Reporting of SADEs"},
    {"title": "Country-specific Requirements", "summary": "Country-specific regulatory and operational requirements.", "originalHeading": "# 10.8. Appendix 8: Country-specific Requirements"},
    {"title": "Protocol Amendment History", "summary": "Documentation of protocol amendments and changes.", "originalHeading": "# 10.9. Appendix 9: Protocol Amendment History"},
    {"title": "References", "summary": "Bibliography of referenced documents and literature.", "originalHeading": "**11. References**"}
]

def create_yaml_frontmatter(title, original_heading):
    """Create YAML frontmatter for markdown files"""
    now = datetime.utcnow().isoformat() + 'Z'
    return f"""---
title: "{title}"
originalHeading: "{original_heading}"
status: pending
createdAt: "{now}"
---
"""

def sanitize_filename(name):
    """Sanitize filename for use in paths"""
    return name.replace('/', '-').replace(':', '-').replace('?', '').replace('!', '').strip()

def sanitize_section_number(section_num):
    """Sanitize section number for folder naming"""
    return section_num.replace('.', '-')

def parse_sections():
    """Parse sections and organize by hierarchy"""
    import re

    section_pattern = re.compile(r'^(#+)\s+(\d+(?:\.\d+)*)\.?\s*(.*)')

    root_modules = {}
    all_sections = []

    for section in sections:
        heading = section['originalHeading']
        match = section_pattern.match(heading)

        if match:
            hashes = len(match.group(1))
            section_num = match.group(2).strip()
            title_part = match.group(3).strip() if match.group(3) else section['title']

            # Clean up title
            clean_title = re.sub(r'[\[\]\*]', '', title_part).strip()
            if not clean_title:
                clean_title = section['title']

            # Remove ", Masking" or similar from bracketed content
            clean_title = re.sub(r'\[([^\]]+),[^\]]*\]', r'[\1]', clean_title)

            section_data = {
                'number': section_num,
                'title': clean_title,
                'summary': section['summary'],
                'originalHeading': heading,
                'level': hashes - 1  # Root starts at level 1 (###)
            }

            parts = section_num.split('.')
            root_module = parts[0]

            if root_module not in root_modules:
                root_modules[root_module] = []

            root_modules[root_module].append(section_data)
            all_sections.append(section_data)
        else:
            # Handle sections without clear numbering (like References)
            section_data = {
                'number': '11',  # References
                'title': section['title'],
                'summary': section['summary'],
                'originalHeading': heading,
                'level': 1
            }
            if '11' not in root_modules:
                root_modules['11'] = []
            root_modules['11'].append(section_data)
            all_sections.append(section_data)

    return root_modules, all_sections

def create_nested_folders(root_modules, base_path):
    """Create nested folder structure"""
    created_files = []

    # Ensure base directory exists
    os.makedirs(base_path, exist_ok=True)

    # Sort root modules numerically
    sorted_modules = sorted(root_modules.keys(), key=lambda x: float(x))

    for module_num in sorted_modules:
        module_sections = root_modules[module_num]

        # Sort sections within module by their full number
        module_sections.sort(key=lambda x: [int(p) for p in x['number'].split('.')])

        # Create root module folder
        module_folder_name = f"Module-{module_num}"
        module_path = os.path.join(base_path, module_folder_name)
        os.makedirs(module_path, exist_ok=True)

        for section in module_sections:
            # Create section folder structure based on hierarchy
            if section['level'] == 1:
                # Root level section - place directly in module folder
                section_path = module_path
                file_name = "content.md"
            else:
                # Subsection - create numbered subfolder
                path_parts = section['number'].split('.')
                if len(path_parts) > 1:
                    # Build hierarchy: 1-Protocol-Summary/1.1-Synopsis/content.md
                    current_path = module_path
                    for i, part in enumerate(path_parts[1:], 1):
                        subfolder_name = f"{'.'.join(path_parts[:i+1])}-{sanitize_filename(section['title'][:50])}"
                        current_path = os.path.join(current_path, subfolder_name)

                    os.makedirs(current_path, exist_ok=True)
                    section_path = current_path
                    file_name = "content.md"
                else:
                    section_path = module_path
                    file_name = "content.md"

            # Create the markdown file
            file_path = os.path.join(section_path, file_name)

            frontmatter = create_yaml_frontmatter(section['title'], section['originalHeading'])
            content = f"{frontmatter}\n# {section['title']}\n\n{section['summary']}\n\n<!-- Content will be generated here -->\n"

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            # Store relative path and section info
            rel_path = os.path.relpath(file_path, base_path)
            created_files.append({
                'path': rel_path,
                'section': f"{section['number']} {section['title']}"
            })

    return created_files

def main():
    # Parse sections
    root_modules, all_sections = parse_sections()

    # Print analysis
    print(f"Total sections: {len(all_sections)}")
    print(f"Root modules: {len(root_modules)}")

    for module_num in sorted(root_modules.keys(), key=lambda x: float(x)):
        count = len(root_modules[module_num])
        print(f"  Module {module_num}: {count} sections")

    # Create nested structure (since 127 > 20 sections)
    base_path = "/Users/rsjaya/Downloads/DossierFlow AI Wireframe Blueprint/outputs/testing"
    created_files = create_nested_folders(root_modules, base_path)

    # Output JSON summary
    result = {
        "structure": "nested",
        "sectionRoot": "sections",
        "files": created_files
    }

    print("\n" + json.dumps(result, indent=2))

    # Also write a summary file
    with open(os.path.join(base_path, "sections-summary.json"), 'w') as f:
        json.dump(result, f, indent=2)

if __name__ == "__main__":
    main()
