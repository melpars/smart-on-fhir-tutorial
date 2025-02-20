(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError(error) {
      console.error("❌ Loading error:", error);
      $('#errors').html(`<p> ❌ Failed to load data: ${JSON.stringify(error)} </p>`);
      drawVisualization(defaultPatient()); // Ensure UI updates on failure
      ret.reject(error);
    }

    function onReady(smart) {
      console.log("🚀 SMART on FHIR client initialized", smart);

      if (!smart.state.tokenResponse || !smart.state.tokenResponse.access_token) {
        console.error("❌ No access token received!");
        $('#errors').html('<p> ❌ No access token! Authorization failed. </p>');
        drawVisualization(defaultPatient());
        return ret.reject("Missing access token");
      }

      console.log("✅ Access Token:", smart.state.tokenResponse.access_token);

      if (!smart.patient) {
        console.error("❌ No patient found in the SMART client.");
        $('#errors').html('<p> ❌ No patient data available. </p>');
        drawVisualization(defaultPatient());
        return ret.reject("No patient data");
      }

      var patient = smart.patient;
      var pt = patient.read();
      var obv = smart.patient.api.fetchAll({
        type: 'Observation',
        query: {
          code: {
            $or: [
              'http://loinc.org|8302-2',
              'http://loinc.org|8462-4',
              'http://loinc.org|8480-6',
              'http://loinc.org|2085-9',
              'http://loinc.org|2089-1',
              'http://loinc.org|55284-4'
            ]
          }
        }
      });

      console.log("🩺 Fetching Patient & Observations...");

      $.when(pt, obv)
        .fail(function(error) {
          console.error("❌ FHIR API Request Failed:", error);
          $('#errors').html('<p> ❌ Failed to fetch FHIR data. See console for details. </p>');
          drawVisualization(defaultPatient());
          ret.reject(error);
        })
        .done(function(patient, obv) {
          console.log("✅ FHIR Patient Data:", patient);
          console.log("✅ FHIR Observations:", obv);

          var byCodes = smart.byCodes(obv, 'code') || {};
          var gender = patient.gender || 'N/A';
          var fname = patient.name?.[0]?.given?.join(' ') || 'N/A';
          var lname = patient.name?.[0]?.family || 'N/A';

          var height = getQuantityValueAndUnit(byCodes['8302-2']?.[0]) || 'N/A';
          var systolicbp = getBloodPressureValue(byCodes['55284-4'], '8480-6') || 'N/A';
          var diastolicbp = getBloodPressureValue(byCodes['55284-4'], '8462-4') || 'N/A';
          var hdl = getQuantityValueAndUnit(byCodes['2085-9']?.[0]) || 'N/A';
          var ldl = getQuantityValueAndUnit(byCodes['2089-1']?.[0]) || 'N/A';

          var p = defaultPatient();
          p.birthdate = patient.birthDate || 'N/A';
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.height = height;
          p.systolicbp = systolicbp;
          p.diastolicbp = diastolicbp;
          p.hdl = hdl;
          p.ldl = ldl;

          console.log("✅ Processed Patient Data:", p);
          
          drawVisualization(p); // ✅ Ensure the UI updates
          ret.resolve(p);
        });
    }

    console.log("🚀 Calling FHIR.oauth2.ready()...");

    FHIR.oauth2.ready(onReady, function(error) {
      console.error("❌ Authorization Error:", error);
    
      // Check if error is undefined and provide a more helpful message
      let errorMessage = error || "Unknown error - Check OAuth2 settings and network requests.";
    
      // Display error in the UI
      $('#errors').html(`<p> ❌ Authorization Failed! ${errorMessage} See console for details. </p>`);
    
      // Ensure proper rejection
      ret.reject(errorMessage);
    });

    return ret.promise();
  };

  function defaultPatient(){
    return {
      fname: 'N/A',
      lname: 'N/A',
      gender: 'N/A',
      birthdate: 'N/A',
      height: 'N/A',
      systolicbp: 'N/A',
      diastolicbp: 'N/A',
      ldl: 'N/A',
      hdl: 'N/A'
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    if (!BPObservations || BPObservations.length === 0) return 'N/A';

    var formattedBPObservations = BPObservations.map(function(observation) {
      var BP = observation.component?.find(function(component) {
        return component.code.coding?.some(coding => coding.code === typeOfPressure);
      });
      return BP ? BP.valueQuantity : null;
    }).filter(Boolean);

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    return (ob && ob.valueQuantity && ob.valueQuantity.value && ob.valueQuantity.unit) 
      ? `${ob.valueQuantity.value} ${ob.valueQuantity.unit}`
      : 'N/A';
  }

  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
  };

})(window);
