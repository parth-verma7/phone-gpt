Pod::Spec.new do |s|
  s.name = 'PhoneGptIOS'
  s.version = '0.1.0'
  s.summary = 'PhoneGPT iOS microphone and background model transfers'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'PhoneGPT'
  s.homepage = 'https://github.com/parth-verma7/phone-gpt'
  s.source = { :git => 'https://github.com/parth-verma7/phone-gpt.git' }
  s.platform = :ios, '16.4'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.frameworks = 'AVFoundation', 'Network', 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
