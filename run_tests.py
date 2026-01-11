#!/usr/bin/env python3
"""
Comprehensive test runner for the Ghana Sign Language Interpreter system.
Runs all backend and frontend tests with proper reporting.
"""

import subprocess
import sys
import os
import argparse
import json
from datetime import datetime
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestRunner:
    """Test runner for GSL Interpreter system"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.api_dir = self.project_root / "api"
        self.tests_dir = self.project_root / "tests"
        self.results = {}
        
    def run_backend_tests(self, test_pattern=None):
        """Run backend Python tests"""
        logger.info("Running backend tests...")
        
        # Change to tests directory
        original_cwd = os.getcwd()
        os.chdir(self.tests_dir)
        
        try:
            # Build pytest command
            cmd = [sys.executable, "-m", "pytest"]
            
            if test_pattern:
                cmd.extend(["-k", test_pattern])
            
            # Add verbose output and coverage
            cmd.extend([
                "-v",
                "--tb=short",
                "--cov=../api/services",
                "--cov-report=html:../coverage_html",
                "--cov-report=json:../coverage.json",
                "--junitxml=../test_results.xml"
            ])
            
            # Run tests
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.tests_dir
            )
            
            # Parse results
            self.results['backend'] = {
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'timestamp': datetime.now().isoformat()
            }
            
            if result.returncode == 0:
                logger.info("✅ Backend tests passed")
            else:
                logger.error("❌ Backend tests failed")
                logger.error(f"STDOUT: {result.stdout}")
                logger.error(f"STDERR: {result.stderr}")
                
            return result.returncode == 0
            
        finally:
            os.chdir(original_cwd)
    
    def run_frontend_tests(self):
        """Run frontend JavaScript/TypeScript tests"""
        logger.info("Running frontend tests...")
        
        # Check if npm is available
        try:
            subprocess.run(["npm", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            logger.warning("npm not found, skipping frontend tests")
            self.results['frontend'] = {
                'success': True,
                'message': 'npm not available, frontend tests skipped',
                'timestamp': datetime.now().isoformat()
            }
            return True
        
        try:
            # Run npm test
            result = subprocess.run(
                ["npm", "test", "--", "--run"],
                capture_output=True,
                text=True,
                cwd=self.project_root
            )
            
            self.results['frontend'] = {
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'timestamp': datetime.now().isoformat()
            }
            
            if result.returncode == 0:
                logger.info("✅ Frontend tests passed")
            else:
                logger.error("❌ Frontend tests failed")
                logger.error(f"STDOUT: {result.stdout}")
                logger.error(f"STDERR: {result.stderr}")
                
            return result.returncode == 0
            
        except Exception as e:
            logger.error(f"Error running frontend tests: {e}")
            self.results['frontend'] = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            return False
    
    def run_integration_tests(self):
        """Run integration tests"""
        logger.info("Running integration tests...")
        
        # Change to tests directory
        original_cwd = os.getcwd()
        os.chdir(self.tests_dir)
        
        try:
            # Run integration tests with pytest
            result = subprocess.run(
                [
                    sys.executable, "-m", "pytest",
                    "-v",
                    "--tb=short",
                    "-m", "integration"
                ],
                capture_output=True,
                text=True,
                cwd=self.tests_dir
            )
            
            self.results['integration'] = {
                'success': result.returncode == 0,
                'return_code': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'timestamp': datetime.now().isoformat()
            }
            
            if result.returncode == 0:
                logger.info("✅ Integration tests passed")
            else:
                logger.error("❌ Integration tests failed")
                logger.error(f"STDOUT: {result.stdout}")
                logger.error(f"STDERR: {result.stderr}")
                
            return result.returncode == 0
            
        finally:
            os.chdir(original_cwd)
    
    def check_dependencies(self):
        """Check if all required dependencies are available"""
        logger.info("Checking dependencies...")
        
        dependencies = {
            'python': self._check_python_dependencies(),
            'node': self._check_node_dependencies(),
            'system': self._check_system_dependencies()
        }
        
        self.results['dependencies'] = dependencies
        return all(deps['available'] for deps in dependencies.values())
    
    def _check_python_dependencies(self):
        """Check Python dependencies"""
        required_packages = [
            'torch', 'numpy', 'mediapipe', 'whisper', 'opencv-python',
            'pytest', 'pytest-cov', 'fastapi', 'websockets', 'sqlalchemy'
        ]
        
        missing = []
        available = []
        
        for package in required_packages:
            try:
                if package == 'opencv-python':
                    import cv2
                elif package == 'whisper':
                    import whisper
                else:
                    __import__(package.replace('-', '_'))
                available.append(package)
            except ImportError:
                missing.append(package)
        
        return {
            'available': len(missing) == 0,
            'available_packages': available,
            'missing_packages': missing
        }
    
    def _check_node_dependencies(self):
        """Check Node.js dependencies"""
        try:
            package_json = self.project_root / "package.json"
            if not package_json.exists():
                return {'available': True, 'message': 'package.json not found'}
            
            with open(package_json) as f:
                package_data = json.load(f)
            
            dependencies = package_data.get('dependencies', {})
            dev_dependencies = package_data.get('devDependencies', {})
            
            return {
                'available': True,
                'dependencies': list(dependencies.keys()),
                'dev_dependencies': list(dev_dependencies.keys())
            }
            
        except Exception as e:
            return {
                'available': False,
                'error': str(e)
            }
    
    def _check_system_dependencies(self):
        """Check system dependencies"""
        system_deps = {}
        
        # Check for ffmpeg (needed for audio processing)
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
            system_deps['ffmpeg'] = True
        except (subprocess.CalledProcessError, FileNotFoundError):
            system_deps['ffmpeg'] = False
        
        return {
            'available': all(system_deps.values()),
            'dependencies': system_deps
        }
    
    def generate_report(self):
        """Generate comprehensive test report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_tests': len(self.results),
                'passed': sum(1 for r in self.results.values() if r.get('success', False)),
                'failed': sum(1 for r in self.results.values() if not r.get('success', False))
            },
            'results': self.results,
            'recommendations': self._generate_recommendations()
        }
        
        # Save report to file
        report_file = self.project_root / "test_report.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Test report saved to {report_file}")
        return report
    
    def _generate_recommendations(self):
        """Generate recommendations based on test results"""
        recommendations = []
        
        # Check backend test results
        backend_result = self.results.get('backend', {})
        if not backend_result.get('success', False):
            recommendations.append("Fix backend test failures before proceeding")
        
        # Check frontend test results
        frontend_result = self.results.get('frontend', {})
        if not frontend_result.get('success', False):
            recommendations.append("Fix frontend test failures or ensure npm is available")
        
        # Check integration test results
        integration_result = self.results.get('integration', {})
        if not integration_result.get('success', False):
            recommendations.append("Fix integration test failures for full system functionality")
        
        # Check dependencies
        deps_result = self.results.get('dependencies', {})
        python_deps = deps_result.get('python', {})
        if python_deps.get('missing_packages'):
            missing = python_deps['missing_packages']
            recommendations.append(f"Install missing Python packages: {', '.join(missing)}")
        
        system_deps = deps_result.get('system', {})
        system_deps_status = system_deps.get('dependencies', {})
        if not system_deps_status.get('ffmpeg', True):
            recommendations.append("Install ffmpeg for audio processing capabilities")
        
        return recommendations
    
    def print_summary(self, report):
        """Print test summary to console"""
        print("\n" + "="*60)
        print("GHANA SIGN LANGUAGE INTERPRETER - TEST SUMMARY")
        print("="*60)
        
        summary = report['summary']
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed']} ✅")
        print(f"Failed: {summary['failed']} ❌")
        
        print("\nDetailed Results:")
        for test_type, result in report['results'].items():
            status = "✅ PASSED" if result.get('success', False) else "❌ FAILED"
            print(f"  {test_type.upper()}: {status}")
            
            if not result.get('success', False) and result.get('error'):
                print(f"    Error: {result['error']}")
        
        if report['recommendations']:
            print("\nRecommendations:")
            for rec in report['recommendations']:
                print(f"  • {rec}")
        
        print("="*60)

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Run comprehensive tests for GSL Interpreter")
    parser.add_argument("--backend-only", action="store_true", help="Run only backend tests")
    parser.add_argument("--frontend-only", action="store_true", help="Run only frontend tests")
    parser.add_argument("--integration-only", action="store_true", help="Run only integration tests")
    parser.add_argument("--pattern", help="Run only tests matching this pattern")
    parser.add_argument("--no-deps-check", action="store_true", help="Skip dependency check")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Create test runner
    runner = TestRunner()
    
    # Check dependencies first
    if not args.no_deps_check:
        deps_ok = runner.check_dependencies()
        if not deps_ok:
            logger.warning("Some dependencies are missing. Tests may fail.")
    
    # Determine which tests to run
    run_backend = not args.frontend_only
    run_frontend = not args.backend_only
    run_integration = not (args.backend_only or args.frontend_only)
    
    # Run tests
    success = True
    
    if run_backend:
        backend_success = runner.run_backend_tests(args.pattern)
        success = success and backend_success
    
    if run_frontend:
        frontend_success = runner.run_frontend_tests()
        success = success and frontend_success
    
    if run_integration:
        integration_success = runner.run_integration_tests()
        success = success and integration_success
    
    # Generate report
    report = runner.generate_report()
    
    # Print summary
    runner.print_summary(report)
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()